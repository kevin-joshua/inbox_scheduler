import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../config/env';

/**
 * Encryption utilities for storing sensitive data (SMTP passwords) at rest
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt sensitive data (e.g., SMTP password)
 * Returns base64-encoded string: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt sensitive data
 * Expects base64-encoded string: iv:authTag:encryptedData
 */
export function decrypt(encryptedData: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  
  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64').toString('utf8');
  const [ivHex, authTagHex, encrypted] = combined.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
