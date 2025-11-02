# DalyKraken 2.0 - Authentication Setup Guide

## Overview

DalyKraken 2.0 now features secure authentication with Google Authenticator (TOTP - Time-based One-Time Password). This guide will help you set up and use the new authentication system.

## Key Features

- **TOTP-based 2FA**: Secure two-factor authentication using Google Authenticator
- **JWT Authentication**: Long-lived JWT tokens (365 days) for persistent sessions
- **No Auto-Logout**: Users remain logged in until they explicitly sign out
- **Secure Backend**: All API endpoints are protected with JWT verification
- **Admin Login Removed**: No more hardcoded credentials

## Setup Instructions

### 1. Create Your First User Account

To create your first user account, you can use the `/auth/create-user` endpoint. Here are two ways to do it:

#### Option A: Using curl
```bash
curl -X POST http://localhost:5001/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_secure_password"}'
```

#### Option B: Using the browser console
1. Start your backend server
2. Open your browser's developer console
3. Run this code:

```javascript
fetch('http://localhost:5001/api/auth/create-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'your_username',
    password: 'your_secure_password'
  })
})
.then(r => r.json())
.then(console.log);
```

**Important**: In production, you should protect this endpoint or remove it after creating your initial user account.

### 2. First Login and TOTP Setup

1. Navigate to the login page at `http://localhost:5173/login`
2. Enter your username and password
3. You'll be redirected to the TOTP setup page
4. Follow these steps:

   **Step 1**: Download Google Authenticator
   - iOS: Download from the App Store
   - Android: Download from Google Play Store

   **Step 2**: Scan the QR Code
   - Open Google Authenticator
   - Tap the "+" button
   - Choose "Scan a QR code"
   - Scan the QR code displayed on screen

   **Alternative**: If you can't scan the QR code, manually enter the secret key shown below the QR code

   **Step 3**: Verify Setup
   - Enter the 6-digit code from Google Authenticator
   - Click "Complete Setup"
   - You'll be logged in and redirected to the dashboard

### 3. Subsequent Logins

For all future logins:

1. Enter your username and password
2. Enter the 6-digit code from Google Authenticator
3. You'll be logged in and stay logged in until you explicitly sign out

## Security Features

### JWT Tokens
- Tokens are stored in `localStorage` with the key `auth_token`
- Tokens expire after 365 days
- Tokens are automatically attached to all API requests via Axios interceptors
- Invalid/expired tokens automatically redirect to login

### Password Security
- Passwords are hashed using bcrypt with 10 salt rounds
- Passwords are never stored in plain text
- Backend validates all password hashes

### TOTP Security
- TOTP secrets are generated with 32-character length
- Secrets are stored encrypted in Firestore
- TOTP verification allows a 2-step window for clock drift
- Each TOTP code can only be used once

### API Protection
- All API endpoints (except `/auth/*` and `/health`) require valid JWT
- Authentication middleware verifies tokens on every request
- 401 errors automatically clear tokens and redirect to login

## Environment Variables

For production deployment, set these environment variables:

```bash
# Backend (.env or Firebase config)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important**: Generate a strong, unique JWT secret for production:
```bash
openssl rand -base64 32
```

## Troubleshooting

### "Invalid TOTP token" Error
- **Cause**: Time sync issues between your device and server
- **Solution**:
  - Ensure your device's clock is accurate
  - Check that automatic time sync is enabled on your phone
  - The TOTP verification allows ±2 time steps (about ±60 seconds)

### "Authentication required" on API calls
- **Cause**: Missing or expired JWT token
- **Solution**:
  - Check if `auth_token` exists in localStorage
  - Clear localStorage and log in again
  - Verify backend JWT_SECRET matches

### Lost Access to Google Authenticator
- **Prevention**: Save the TOTP secret key (shown during setup) in a secure location
- **Recovery**:
  - If you saved the secret, manually add it to a new Google Authenticator instance
  - Otherwise, you'll need database access to reset the user's TOTP settings

### Can't create first user
- **Issue**: Endpoint returns 404
- **Solution**: Ensure backend is running and the route is accessible
- **Check**: Look at backend console for any errors

## API Endpoints

### Public Endpoints (No Auth Required)
- `GET  /health` - Health check
- `POST /auth/login` - Initial login with username/password
- `POST /auth/verify-totp` - Verify TOTP code and get JWT
- `POST /auth/setup-totp` - Generate QR code for TOTP setup
- `POST /auth/confirm-totp-setup` - Confirm TOTP setup with first code
- `POST /auth/create-user` - Create new user (should be protected in production)

### Protected Endpoints (Auth Required)
- `GET  /auth/verify` - Verify current JWT token
- All other API endpoints require valid JWT in Authorization header

## Implementation Details

### Frontend Flow
1. User enters credentials → `POST /auth/login`
2. If TOTP not set up → Redirect to `/totp-setup`
3. If TOTP enabled → Show TOTP input
4. User enters TOTP code → `POST /auth/verify-totp` or `POST /auth/confirm-totp-setup`
5. Backend returns JWT token
6. Frontend stores token in localStorage
7. All subsequent API calls include `Authorization: Bearer <token>` header

### Backend Flow
1. Request received
2. `authenticateToken` middleware extracts token from Authorization header
3. JWT is verified using JWT_SECRET
4. User info attached to `req.user`
5. Request proceeds to route handler
6. If token invalid/expired, return 401 error

### Session Management
- No server-side session storage
- Stateless JWT-based authentication
- Token stored client-side only
- No automatic logout/timeout
- Manual logout clears token from localStorage

## Production Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to a strong, unique value
- [ ] Store JWT_SECRET in environment variables (not in code)
- [ ] Protect or remove the `/auth/create-user` endpoint
- [ ] Enable HTTPS for all connections
- [ ] Configure CORS to only allow your production domain
- [ ] Test the full authentication flow
- [ ] Set up backup recovery method for TOTP
- [ ] Document the TOTP secret in a secure location
- [ ] Test token expiration and refresh logic
- [ ] Monitor authentication failures and suspicious activity

## Backup & Recovery

### Backing Up TOTP Secret
During TOTP setup, the secret key is displayed. Save this in a secure location such as:
- Password manager (recommended)
- Encrypted file
- Secure notes app with encryption

### Recovering Access
If you lose access to Google Authenticator:
1. Use the saved secret to add the account to a new authenticator app
2. Or, with database access, manually update the user's `totpEnabled` field to `false` in Firestore

### Resetting a User's TOTP
As an admin with Firestore access:
```javascript
// In Firestore console or admin script
db.collection('users').doc('USER_ID').update({
  totpEnabled: false,
  totpSecret: null
});
```
The user will need to set up TOTP again on next login.

## Testing the System

### Test User Creation
```bash
# Create test user
curl -X POST http://localhost:5001/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "TestPassword123!"}'
```

### Test Login Flow
1. Go to login page
2. Enter test credentials
3. Follow TOTP setup
4. Verify you can access protected pages
5. Refresh browser - should stay logged in
6. Logout and login again with TOTP

### Test API Protection
```bash
# Without auth - should fail
curl http://localhost:5001/api/account/balance

# With auth - should succeed
curl http://localhost:5001/api/account/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Check backend logs for authentication errors
4. Verify all dependencies are installed correctly

## Security Notes

- Never share your TOTP secret key
- Never commit JWT_SECRET to version control
- Use a password manager to generate strong passwords
- Enable device security (PIN/biometric) on your phone
- Keep your Google Authenticator app updated
- Consider implementing backup codes for emergency access
- Regularly review active sessions and tokens
- Monitor for unusual authentication activity

## Future Enhancements

Potential improvements for the authentication system:
- Backup codes for emergency access
- Email verification on signup
- Password reset functionality
- Multi-device TOTP support
- Biometric authentication
- Security audit logs
- Suspicious activity alerts
- Session management dashboard
- Token refresh mechanism with shorter expiry
- Rate limiting on authentication endpoints
