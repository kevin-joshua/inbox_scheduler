export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Email {
  id: string;
  batchId: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string;
  messageId?: string;
  attempts: number;
  lastError?: string;
}

export interface Batch {
  id: string;
  subject: string;
  body: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
}

export interface Sender {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  createdAt: string;
}
