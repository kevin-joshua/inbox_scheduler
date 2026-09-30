/**
 * Rate-limit gate using a Redis Lua script for atomic check-and-increment.
 *
 * Enforces two constraints per sender, atomically, in a single round-trip:
 *
 *  1. HOURLY CAP  – At most MAX_EMAILS_PER_HOUR_PER_SENDER emails per
 *                   rolling 60-minute window (keyed by UTC hour bucket).
 *
 *  2. MIN DELAY   – At least MIN_DELAY_BETWEEN_EMAILS_MS milliseconds must
 *                   have elapsed since the last send for this sender
 *                   (prevents burst-spamming within the allowed hour).
 *
 * Both checks are performed and the counter is incremented in one atomic
 * Lua script so there are no TOCTOU races between concurrent workers.
 *
 * Return values
 * ─────────────
 *  { allowed: true  }               → proceed with sending
 *  { allowed: false, retryAt: ms }  → re-schedule job for retryAt
 */

import { getRedisClient } from '../../infra/redis';
import { env } from '../../config/env';
import { logger } from '../../infra/logger';

export interface GateResult {
  allowed: boolean;
  retryAt?: number; // Unix timestamp in ms when sending can be retried
}

// ─── Lua script ──────────────────────────────────────────────────────────────
//
// KEYS[1] = hourly counter key   e.g.  "rl:sender:<id>:2026-09-30-14"
// KEYS[2] = last-sent key        e.g.  "rl:sender:<id>:last"
//
// ARGV[1] = hourly limit         (integer)
// ARGV[2] = min delay ms         (integer)
// ARGV[3] = current timestamp ms (integer)
// ARGV[4] = TTL for hourly key   (seconds, always 7200 = 2 hours)
//
// Returns a flat table:
//   [1] = "1" (allowed) | "0" (denied)
//   [2] = retryAt timestamp in ms (only meaningful when denied)

const GATE_LUA = `
local hourly_key  = KEYS[1]
local last_key    = KEYS[2]
local limit       = tonumber(ARGV[1])
local min_delay   = tonumber(ARGV[2])
local now         = tonumber(ARGV[3])
local ttl         = tonumber(ARGV[4])

-- Check min-delay constraint
local last_sent = tonumber(redis.call('GET', last_key) or 0)
if last_sent > 0 and (now - last_sent) < min_delay then
  local retry_at = last_sent + min_delay
  return {0, retry_at}
end

-- Check hourly cap
local current = tonumber(redis.call('GET', hourly_key) or 0)
if current >= limit then
  -- Retry at the start of the next hour bucket
  local seconds_in_hour = 3600
  local ms_in_hour      = seconds_in_hour * 1000
  local ms_into_hour    = now % ms_in_hour
  local retry_at        = now - ms_into_hour + ms_in_hour
  return {0, retry_at}
end

-- Both checks passed – increment counters
redis.call('INCR',  hourly_key)
redis.call('EXPIRE', hourly_key, ttl)
redis.call('SET',   last_key, now, 'EX', ttl)

return {1, 0}
`;

// ─── Rate-limit gate ──────────────────────────────────────────────────────────

export class RateLimitGate {
  private scriptSha: string | null = null;

  /**
   * Load the Lua script into Redis (SCRIPT LOAD) so we can call it via EVALSHA.
   * Called once on first use; SHA is cached for the lifetime of the process.
   */
  private async ensureScript(): Promise<string> {
    if (this.scriptSha) return this.scriptSha;

    const redis = getRedisClient();
    this.scriptSha = await redis.script('LOAD', GATE_LUA) as string;
    logger.debug({ sha: this.scriptSha }, 'Rate-limit Lua script loaded');
    return this.scriptSha;
  }

  /**
   * Check whether a sender is allowed to send right now.
   *
   * @param senderId  The sender's database ID (used to build Redis keys)
   * @returns GateResult – { allowed: true } or { allowed: false, retryAt }
   */
  async checkSender(senderId: string): Promise<GateResult> {
    const redis = getRedisClient();

    const now = Date.now();
    // Hour bucket: "2026-09-30-14"
    const date = new Date(now);
    const bucket = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCHours()).padStart(2, '0'),
    ].join('-');

    const hourlyKey = `rl:sender:${senderId}:${bucket}`;
    const lastKey   = `rl:sender:${senderId}:last`;

    const sha = await this.ensureScript();

    try {
      const result = await redis.evalsha(
        sha,
        2,
        hourlyKey,
        lastKey,
        String(env.MAX_EMAILS_PER_HOUR_PER_SENDER),
        String(env.MIN_DELAY_BETWEEN_EMAILS_MS),
        String(now),
        String(7200) // 2-hour TTL; keeps key alive across the hour boundary
      ) as [string | number, string | number];

      const allowed = Number(result[0]) === 1;
      const retryAt = Number(result[1]);

      logger.debug(
        { senderId, allowed, retryAt: allowed ? undefined : retryAt },
        'Rate-limit gate result'
      );

      return allowed ? { allowed: true } : { allowed: false, retryAt };
    } catch (err: any) {
      // If the SHA is gone (e.g. Redis restart / SCRIPT FLUSH), reload and retry once.
      if (err?.message?.includes('NOSCRIPT')) {
        this.scriptSha = null;
        logger.warn({ senderId }, 'Rate-limit script not found in Redis, reloading…');
        return this.checkSender(senderId);
      }
      throw err;
    }
  }
}

export const rateLimitGate = new RateLimitGate();
