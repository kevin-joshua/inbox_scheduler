--[[
  Rate Limit Gate Lua Script for Redis

  TODO(lld): Implement atomic rate limiting check for per-sender email sending.
  
  This script should:
  1. Check the sender's hourly email count (rolling window or fixed hour)
  2. Check the last email sent timestamp for MIN_DELAY_BETWEEN_EMAILS_MS
  3. If both checks pass, increment counter and update timestamp, return "OK"
  4. If checks fail, calculate and return the earliest retry timestamp
  
  Keys:
    KEYS[1] = sender hourly counter key (e.g., "sender:{senderId}:hour:{hour}")
    KEYS[2] = sender last sent timestamp key (e.g., "sender:{senderId}:last")
  
  Args:
    ARGV[1] = senderId
    ARGV[2] = current timestamp (ms)
    ARGV[3] = MAX_EMAILS_PER_HOUR_PER_SENDER
    ARGV[4] = MIN_DELAY_BETWEEN_EMAILS_MS
  
  Returns:
    "OK" if allowed
    retryAt timestamp (ms) if denied
]]

-- Placeholder implementation
return "OK"
