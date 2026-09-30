# Troubleshooting: 400 Bad Request When Adding Sender

## Issue
Getting `API Error: 400 Bad Request` when trying to add a sender account.

## Debugging Steps

### 1. Check Browser Console

Open browser DevTools (F12) and look for:

```
=== Creating Sender ===
Email: ...
SMTP Host: ...
SMTP Port: ... Type: number
SMTP User: ...
SMTP Pass: [SET]
Full payload: { ... }
```

**Verify:**
- All fields are present
- `smtpPort` is a **number**, not a string
- All values are trimmed (no extra spaces)

### 2. Check Authentication

The API requires authentication. Test if you're logged in:

```javascript
// In browser console:
fetch('http://localhost:4000/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

**Expected:** Your user info
**If 401:** You're not logged in - refresh and login again

### 3. Test API Directly

Test the endpoint with curl:

```bash
# Get your cookie first
# 1. Login via browser
# 2. Open DevTools → Application → Cookies
# 3. Copy the value of 'reachinbox_session'

# Then test:
curl -X POST http://localhost:4000/senders \
  -H "Content-Type: application/json" \
  -H "Cookie: reachinbox_session=YOUR_TOKEN_HERE" \
  -d '{
    "email": "test@example.com",
    "smtpHost": "smtp.ethereal.email",
    "smtpPort": 587,
    "smtpUser": "test.user@ethereal.email",
    "smtpPass": "testpassword123"
  }'
```

**Expected 201:** Success
**400:** Check what error message is returned

### 4. Check Backend Logs

In the terminal running `npm run dev` (backend), look for:

```
POST /senders
Failed to create sender
SMTP credential validation failed
```

### 5. Common Causes

#### Missing Fields
Backend expects exactly:
- `email` (string)
- `smtpHost` (string)
- `smtpPort` (number)
- `smtpUser` (string)
- `smtpPass` (string)

#### Invalid SMTP Credentials
Backend **validates** credentials by testing SMTP connection.

**Error:** "Invalid SMTP credentials: Unable to connect to SMTP server"

**Solution:**
- Use valid Ethereal account
- Get one at https://ethereal.email/
- Copy exact credentials

#### Type Mismatch
`smtpPort` must be sent as **number**, not string.

**Wrong:** `"587"`
**Right:** `587`

Fix in frontend:
```typescript
smtpPort: parseInt(smtpPort, 10)  // ✓ Converts to number
```

#### Authentication Cookie
Cookie might be:
- Expired (7 days)
- From different domain
- Blocked by browser

**Solution:** Logout and login again

### 6. Quick Test with Ethereal

1. Go to https://ethereal.email/
2. Click "Create Ethereal Account"
3. Copy the credentials shown
4. Use in Add Sender form:
   - Email: `[generated]@ethereal.email`
   - Host: `smtp.ethereal.email`
   - Port: `587`
   - User: `[generated]@ethereal.email`
   - Pass: `[the password shown]`

### 7. Enable Network Tab

DevTools → Network tab → filter by "senders"

Check the request:
- **Request URL:** `http://localhost:4000/senders`
- **Method:** POST
- **Status:** 400
- **Request Headers:** Should include `Cookie: reachinbox_session=...`
- **Request Payload:** Check if all fields are present

Click on the request → Response tab to see the exact error.

### 8. Typical Error Responses

#### Missing Authentication
```json
{ "error": "Not authenticated" }
```
**Fix:** Login again

#### Missing Fields
```json
{
  "error": "Missing required fields",
  "required": ["email", "smtpHost", "smtpPort", "smtpUser", "smtpPass"]
}
```
**Fix:** Check console logs to see what's being sent

#### Invalid SMTP
```json
{ "error": "Invalid SMTP credentials: Unable to connect to SMTP server" }
```
**Fix:** Use valid credentials (try Ethereal)

### 9. Working Example

This should work (test in browser console):

```javascript
fetch('http://localhost:4000/senders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'test@ethereal.email',
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    smtpUser: 'test.user@ethereal.email',
    smtpPass: 'YourEtherealPassword'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### 10. Still Not Working?

Check:
1. Backend is running: `http://localhost:4000/health` should return 200
2. Backend has senders route: Check `backend/src/app.ts` for `app.use('/senders', sendersRouter)`
3. Database is connected: Health endpoint shows `database: "connected"`
4. Try restarting both frontend and backend

## Quick Fix Checklist

- [ ] Logged in to the app?
- [ ] Backend running on port 4000?
- [ ] Used valid Ethereal credentials?
- [ ] Checked browser console for logs?
- [ ] Checked Network tab for actual error response?
- [ ] Verified smtpPort is a number, not string?
- [ ] Tried with curl to isolate frontend vs backend issue?
