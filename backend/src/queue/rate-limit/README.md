# Rate Limiting System

## Overview

The rate limiting system enforces two constraints per sender:

1. **Hourly Cap**: Maximum emails per sender per hour (default: 100)
2. **Min Delay**: Minimum milliseconds between consecutive emails (default: 1000ms)

## Components

### 1. Rate Limit Gate (`gate.ts`)

**Atomic Redis Lua Script:**
- Checks both constraints in a single round-trip
- Increments counter only if allowed
- Returns `{ allowed: true }` or `{ allowed: false, retryAt: ms }`

**Redis Keys:**
```
rl:sender:{senderId}:{YYYY-MM-DD-HH}  → Hourly counter (TTL: 2h)
rl:sender:{senderId}:last              → Last sent timestamp (TTL: 24h)
```

**Usage:**
```typescript
const gate = await rateLimitGate.checkSender(senderId);

if (!gate.allowed) {
  // Reschedule job for gate.retryAt
  await emailProducer.addEmailJob(jobData, new Date(gate.retryAt));
}
```

### 2. Rate Limit Notifier (`notifier.ts`)

**Purpose:** Notify users ONCE per hour when a sender hits capacity.

**Redis Keys:**
```
rl:sender:{senderId}:notified:{YYYY-MM-DD-HH}  → Notification flag (TTL: 2h)
```

**Usage:**
```typescript
const shouldNotify = await rateLimitNotifier.shouldNotify(senderId);

if (shouldNotify) {
  // Send Slack notification
  await notifyQueue.add('sender_limit_reached', {
    userId,
    message: 'Sender has reached hourly limit...',
    eventType: 'sender_limit_reached',
    senderId,
    senderEmail,
  });
}
```

**Methods:**
- `shouldNotify(senderId)`: Returns true only once per hour per sender
- `markAsNotified(senderId)`: Manually mark as notified (testing)
- `resetNotification(senderId)`: Reset flag (testing)
- `hasBeenNotified(senderId)`: Check if already notified (read-only)

## Integration Flow

### Email Worker (`email.worker.ts`)

```
1. Claim email (idempotency guard)
2. Check rate limit gate
   ├─ Allowed? → Continue to step 3
   └─ Denied? → 
      ├─ Revert DB to SCHEDULED
      ├─ Enqueue new job at retryAt
      ├─ Check if should notify
      │  └─ If yes: Send Slack notification
      └─ Throw UnrecoverableError (close this job)
3. Load sender credentials
4. Send via SMTP
5. Mark as SENT
6. Enqueue index + notify jobs
```

### Notification Message

When a sender hits the hourly limit, the user receives:

```
⚠️ Sender limit reached: sender@example.com has hit the hourly 
limit of 100 emails. Emails will resume automatically at the 
top of the next hour.
```

**Key Points:**
- Only sent once per hour per sender (no spam)
- Includes sender email for context
- Mentions limit value from config
- Reassures automatic resumption
- Silent if Slack not connected

## Configuration

**Environment Variables:**
```bash
MAX_EMAILS_PER_HOUR_PER_SENDER=100   # Hourly cap
MIN_DELAY_BETWEEN_EMAILS_MS=1000      # Min delay (1 second)
```

## Testing

### Test Rate Limit Notification

```typescript
import { rateLimitNotifier } from './notifier';

// First call returns true
const shouldNotify1 = await rateLimitNotifier.shouldNotify('sender-123');
console.log(shouldNotify1); // true

// Second call returns false (same hour)
const shouldNotify2 = await rateLimitNotifier.shouldNotify('sender-123');
console.log(shouldNotify2); // false

// Reset for testing
await rateLimitNotifier.resetNotification('sender-123');
const shouldNotify3 = await rateLimitNotifier.shouldNotify('sender-123');
console.log(shouldNotify3); // true
```

### Test Rate Limit Gate

```typescript
import { rateLimitGate } from './gate';

// First email allowed
const gate1 = await rateLimitGate.checkSender('sender-123');
console.log(gate1); // { allowed: true }

// After 100 emails in same hour
const gate2 = await rateLimitGate.checkSender('sender-123');
console.log(gate2); // { allowed: false, retryAt: 1727712000000 }
```

## Monitoring

### Redis Keys to Monitor

```bash
# Hourly counters (current hour)
redis-cli KEYS "rl:sender:*:2026-09-30-14"

# Check specific sender's count
redis-cli GET "rl:sender:cm3x123:2026-09-30-14"

# Check notification status
redis-cli GET "rl:sender:cm3x123:notified:2026-09-30-14"

# Check last sent timestamp
redis-cli GET "rl:sender:cm3x123:last"
```

### Logs to Monitor

```bash
# Rate limit denials
grep "Rate limited" logs/worker.log

# Notifications sent
grep "Notifying user of sender rate limit" logs/worker.log

# Notification checks
grep "Rate limit notification check" logs/worker.log
```

## Troubleshooting

### User Not Receiving Notifications

**Check:**
1. Slack connected? `GET /slack/status`
2. Notification sent? Check worker logs
3. Redis key exists? `redis-cli GET rl:sender:{id}:notified:{hour}`

**Reset notification flag:**
```typescript
await rateLimitNotifier.resetNotification(senderId);
```

### Emails Not Resuming After Hour Change

**Check:**
1. Redis hourly counter TTL (should be 2h)
2. Delayed jobs in queue: `GET /admin/queues`
3. Worker running? `ps aux | grep worker`

**Manual reset:**
```bash
redis-cli DEL "rl:sender:{senderId}:2026-09-30-14"
redis-cli DEL "rl:sender:{senderId}:last"
```

## Security

### What's Logged
- ✅ Sender ID
- ✅ User ID
- ✅ Email ID
- ✅ Event type
- ✅ Rate limit decision

### What's NOT Logged
- ❌ Sender email in rate limit gate (only in notification)
- ❌ Recipient addresses
- ❌ Email body/subject
- ❌ SMTP credentials
- ❌ Slack webhook URLs

## Future Enhancements

1. **Per-User Limits**: Track total sends across all user's senders
2. **Dynamic Limits**: Adjust based on sender reputation
3. **Burst Allowance**: Allow short bursts above hourly average
4. **Notification Throttling**: Aggregate multiple senders in one message
5. **Dashboard Integration**: Show rate limit status in UI
6. **Predictive Alerts**: Warn before hitting limit (e.g., at 80%)
