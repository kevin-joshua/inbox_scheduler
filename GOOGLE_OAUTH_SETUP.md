# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth for the ReachInbox Email Scheduler.

## Prerequisites

- Google account
- Project running on `http://localhost:4000` (backend) and `http://localhost:3000` (frontend)

## Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `ReachInbox Email Scheduler`
4. Click **Create**

### 2. Enable Google+ API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (for testing) or **Internal** (for organization use)
3. Click **Create**

**Fill in the form:**
- **App name**: ReachInbox Email Scheduler
- **User support email**: Your email
- **App logo**: (optional)
- **Application home page**: http://localhost:3000
- **Authorized domains**: (leave empty for localhost)
- **Developer contact information**: Your email

4. Click **Save and Continue**

**Scopes:**
1. Click **Add or Remove Scopes**
2. Add these scopes:
   - `userinfo.email`
   - `userinfo.profile`
3. Click **Update** → **Save and Continue**

**Test users** (for External apps):
1. Click **Add Users**
2. Add your test email addresses
3. Click **Save and Continue**

4. Review and click **Back to Dashboard**

### 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: Web application
4. **Name**: ReachInbox Web Client

**Authorized JavaScript origins:**
```
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:4000/auth/google/callback
```

5. Click **Create**
6. **Copy** the Client ID and Client Secret (you'll need these!)

### 5. Update Environment Variables

Open your `.env` file and update:

```bash
# Replace with your actual credentials
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
```

Also update `backend/.env` with the same values.

### 6. Restart the Backend

```bash
cd backend
npm run dev
```

The server should start without warnings about missing OAuth credentials.

## Testing the OAuth Flow

1. Start both backend and frontend:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. Open http://localhost:3000/login

3. Click **Sign in with Google**

4. You should be redirected to Google's consent screen

5. Select your test account

6. Grant permissions

7. You should be redirected back to http://localhost:3000/dashboard

8. Your authentication cookie is now set!

## Verify Authentication

Test the `/auth/me` endpoint:

```bash
# This should return your user info
curl http://localhost:4000/auth/me \
  -H "Cookie: reachinbox_session=YOUR_COOKIE_VALUE" \
  --cookie-jar cookies.txt
```

Or simply open the browser DevTools → Application → Cookies and check for `reachinbox_session`.

## Production Setup

For production deployment:

1. **Update Authorized Origins:**
   - Add your production domain: `https://yourdomain.com`

2. **Update Redirect URIs:**
   - Add: `https://yourdomain.com/api/auth/google/callback`

3. **Update Environment Variables:**
   ```bash
   GOOGLE_CLIENT_ID=your-prod-client-id
   GOOGLE_CLIENT_SECRET=your-prod-client-secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   FRONTEND_URL=https://yourdomain.com
   NODE_ENV=production
   ```

4. **OAuth Consent Screen:**
   - Submit for verification if using "External"
   - Add privacy policy and terms of service URLs

## Troubleshooting

### Error: redirect_uri_mismatch

**Cause**: The redirect URI in your OAuth request doesn't match the one configured in Google Cloud Console.

**Solution**: 
- Check that `GOOGLE_REDIRECT_URI` in `.env` exactly matches the URI in Google Console
- URIs are case-sensitive
- `http` vs `https` matters
- Trailing slashes matter

### Error: Access blocked: This app's request is invalid

**Cause**: The OAuth consent screen isn't fully configured.

**Solution**: Complete all steps in the OAuth consent screen configuration.

### Error: Google OAuth credentials not configured

**Cause**: Environment variables not loaded.

**Solution**:
```bash
# Make sure .env exists in backend/
cd backend
cat .env

# Restart the server
npm run dev
```

### Users see "This app isn't verified"

**Cause**: App is in testing mode with external users.

**Solutions**:
1. Click "Advanced" → "Go to [App] (unsafe)" for testing
2. Or publish your app (requires verification)
3. Or use "Internal" user type (requires Google Workspace)

## Security Notes

1. **Never commit credentials**: `.env` is in `.gitignore`
2. **Use HTTPS in production**: Set `secure: true` for cookies
3. **Rotate secrets regularly**: Especially after any exposure
4. **Limit scopes**: Only request `email` and `profile`
5. **Monitor usage**: Check Google Cloud Console for suspicious activity

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OAuth Consent Screen Guide](https://support.google.com/cloud/answer/10311615)
- [OAuth Client ID Setup](https://support.google.com/cloud/answer/6158849)
