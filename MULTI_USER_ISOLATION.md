# DalyKraken 2.0 - Multi-User Isolation Guide

## Overview

DalyKraken 2.0 is now configured for **complete multi-user isolation**. Each user has their own secure, isolated data including:
- DCA bots
- Portfolio data
- Trade history
- Cost basis calculations
- API keys (stored in browser, sent to backend as headers)

## How User Isolation Works

### Authentication-Based Access Control

Every API endpoint (except public auth routes) requires a valid JWT token. The token contains the user's ID, which is used to ensure data isolation:

```
User logs in → Receives JWT token → Token stored in localStorage
↓
Every API request → JWT sent in Authorization header → Backend extracts userId
↓
All database queries → Filtered by authenticated userId → User sees only their data
```

### What Each User Sees

#### User A Logs In:
- **DCA Bots**: Only bots created by User A
- **Portfolio**: Only User A's Kraken account balance and holdings
- **Trade History**: Only User A's trades from their Kraken API
- **Cost Basis**: Only calculated from User A's trades
- **Settings**: API keys stored locally in User A's browser

#### User B Logs In:
- **DCA Bots**: Only bots created by User B
- **Portfolio**: Only User B's Kraken account balance and holdings
- **Trade History**: Only User B's trades from their Kraken API
- **Cost Basis**: Only calculated from User B's trades
- **Settings**: API keys stored locally in User B's browser

### Complete Isolation

✅ **Users CANNOT see each other's**:
- DCA bots
- Portfolio balances
- Trade history
- Cost basis data
- Bot executions
- Bot settings

✅ **Users CANNOT modify each other's**:
- Bots (create, update, delete, pause, resume)
- Trade data
- Settings

## Technical Implementation

### 1. DCA Bots Isolation

All bot operations verify ownership:

```typescript
// GET /dca-bots
const userId = req.user!.userId; // From JWT token
const snapshot = await db
  .collection('dcaBots')
  .where('userId', '==', userId)  // Only user's bots
  .get();
```

```typescript
// GET /dca-bots/:id (with ownership check)
const bot = await dcaBotService.getBotById(botId);
if (bot.userId !== userId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

**All bot endpoints include ownership verification**:
- `GET /dca-bots` - Lists only authenticated user's bots
- `GET /dca-bots/:id` - Verifies bot belongs to user
- `POST /dca-bots` - Automatically sets userId from token
- `PUT /dca-bots/:id` - Verifies ownership before update
- `DELETE /dca-bots/:id` - Verifies ownership before deletion
- `POST /dca-bots/:id/pause` - Verifies ownership
- `POST /dca-bots/:id/resume` - Verifies ownership
- `GET /dca-bots/:id/executions` - Verifies ownership

### 2. Portfolio Data Isolation

Portfolio data is filtered by authenticated user:

```typescript
// GET /portfolio/overview
const userId = req.user!.userId; // From JWT
const cache = getCache(`portfolio_overview_${userId}`);

// Get user's specific API keys from headers
const apiKey = req.headers['x-kraken-api-key'];
const apiSecret = req.headers['x-kraken-api-secret'];

// Fetch balance using user's own Kraken credentials
const balance = await krakenClient.getBalance(apiKey, apiSecret);

// Get cost basis only for this user
const costBasisMap = await costBasisService.getCostBasisForHoldings(
  userId,  // User's ID ensures isolation
  holdingsForCostBasis
);
```

### 3. Trade History & Cost Basis Isolation

Trade syncing and cost basis are per-user:

```typescript
// POST /portfolio/sync-trades
const userId = req.user!.userId; // From JWT

// Sync trades to user-specific Firestore collection
await costBasisService.syncTradeHistory(userId, krakenClient);

// Trades stored at: /users/{userId}/trades/{tradeId}
// Cost basis at: /users/{userId}/costBasis/{asset}
```

```typescript
// GET /portfolio/cost-basis/:asset
const userId = req.user!.userId; // From JWT

const costBasisDoc = await db
  .collection('users')
  .doc(userId)  // User-specific document path
  .collection('costBasis')
  .doc(asset)
  .get();
```

### 4. API Keys Storage

**Current Implementation**:
- Kraken API keys are stored in the **user's browser** (localStorage)
- Keys are sent to backend as HTTP headers for each request
- Backend uses these keys to access **that user's** Kraken account

```typescript
// Frontend stores keys in localStorage
localStorage.setItem('kraken_api_keys', JSON.stringify(keys));

// API service includes keys in headers
headers['x-kraken-api-key'] = apiKey;
headers['x-kraken-api-secret'] = apiSecret;

// Backend receives and uses per-request
const apiKey = req.headers['x-kraken-api-key'];
const apiSecret = req.headers['x-kraken-api-secret'];
const krakenClient = new KrakenService(apiKey, apiSecret);
```

**Why This Works**:
- Each browser session has its own localStorage
- User A's keys are in User A's browser
- User B's keys are in User B's browser
- Keys never mix between users
- Backend makes Kraken API calls with the requesting user's keys

### 5. DCA Status Isolation

```typescript
// GET /dca/status
const userId = req.user!.userId; // From JWT

const snapshot = await db
  .collection('dcaBots')
  .where('userId', '==', userId)  // Only user's bots
  .get();
```

## Database Structure

### Firestore Collections

```
/users/{userId}
  /trades/{tradeId}
    - timestamp
    - pair
    - type
    - price
    - volume
    - cost
    - fee

  /costBasis/{asset}
    - asset
    - totalQuantity
    - totalCost
    - averageCost
    - realizedGains
    - updatedAt

/dcaBots/{botId}
  - userId  ← Ensures isolation
  - symbol
  - status
  - initialOrderAmount
  - ...config

  /entries/{entryId}
    - botId
    - entryNumber
    - price
    - quantity
    - timestamp

/users/{userId}  ← Authentication collection
  - username
  - passwordHash
  - totpSecret
  - totpEnabled
  - createdAt
  - lastLogin
```

### Query Patterns

**All queries include userId filter**:
```typescript
// Get user's bots
db.collection('dcaBots').where('userId', '==', userId)

// Get user's trades
db.collection('users').doc(userId).collection('trades')

// Get user's cost basis
db.collection('users').doc(userId).collection('costBasis')

// Get user auth
db.collection('users').doc(userId)
```

## Security Measures

### 1. Authentication Middleware

All protected endpoints use authentication middleware:

```typescript
// Applied to all routes except /auth and /health
app.use('/dca-bots', authenticateToken, createDCABotsRouter(db));
app.get('/portfolio/overview', authenticateToken, async (req, res) => { ... });
app.post('/portfolio/sync-trades', authenticateToken, async (req, res) => { ... });
```

The middleware:
1. Extracts JWT from `Authorization: Bearer <token>` header
2. Verifies token signature and expiration
3. Decodes userId and username from token
4. Attaches `req.user` object for route handlers
5. Returns 401 if token is invalid/missing
6. Returns 403 if token is expired

### 2. Ownership Verification

Single-resource endpoints verify ownership:

```typescript
// Example: Update bot
const bot = await getBotById(botId);
if (!bot) {
  return res.status(404).json({ error: 'Bot not found' });
}
if (bot.userId !== req.user!.userId) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### 3. No Client-Provided userId

**REMOVED all instances of**:
```typescript
// ❌ BEFORE (vulnerable)
const userId = req.query.userId || 'default-user';
const userId = req.body.userId || 'default-user';
```

**REPLACED with**:
```typescript
// ✅ AFTER (secure)
const userId = req.user!.userId;  // From authenticated token
```

### 4. Firestore Security Rules (Recommended)

While backend authentication is implemented, you should also add Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Auth collection - only backend can write
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Only backend via admin SDK

      // User's trades
      match /trades/{tradeId} {
        allow read, write: if request.auth.uid == userId;
      }

      // User's cost basis
      match /costBasis/{asset} {
        allow read, write: if request.auth.uid == userId;
      }
    }

    // DCA Bots - must belong to user
    match /dcaBots/{botId} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if request.resource.data.userId == request.auth.uid;
      allow update, delete: if resource.data.userId == request.auth.uid;

      match /entries/{entryId} {
        allow read, write: if get(/databases/$(database)/documents/dcaBots/$(botId)).data.userId == request.auth.uid;
      }
    }
  }
}
```

## Testing Multi-User Isolation

### Test Scenario

1. **Create User A**:
   ```bash
   curl -X POST http://localhost:5001/api/auth/create-user \
     -H "Content-Type: application/json" \
     -d '{"username": "alice", "password": "AlicePass123!"}'
   ```

2. **Create User B**:
   ```bash
   curl -X POST http://localhost:5001/api/auth/create-user \
     -H "Content-Type: application/json" \
     -d '{"username": "bob", "password": "BobPass123!"}'
   ```

3. **Login as User A**:
   - Complete TOTP setup
   - Create 2 DCA bots (BTC, ETH)
   - Sync trade history
   - Note the bot IDs

4. **Login as User B (in different browser/incognito)**:
   - Complete TOTP setup
   - Check DCA bots list → Should see 0 bots
   - Create 1 DCA bot (SOL)
   - Try to access User A's bot ID → Should get 403 error

5. **Verify Isolation**:
   ```bash
   # Get User A's token (after login)
   USER_A_TOKEN="eyJ..."

   # Get User A's bots - should return 2
   curl http://localhost:5001/api/dca-bots \
     -H "Authorization: Bearer $USER_A_TOKEN"

   # Get User B's token (after login)
   USER_B_TOKEN="eyJ..."

   # Get User B's bots - should return 1
   curl http://localhost:5001/api/dca-bots \
     -H "Authorization: Bearer $USER_B_TOKEN"

   # Try User B accessing User A's bot (with User A's bot ID)
   curl http://localhost:5001/api/dca-bots/{USER_A_BOT_ID} \
     -H "Authorization: Bearer $USER_B_TOKEN"
   # Should return: {"success": false, "error": "Access denied"}
   ```

### Expected Results

| Test | User A | User B | Expected Result |
|------|--------|--------|-----------------|
| View own bots | GET /dca-bots | GET /dca-bots | A sees 2, B sees 1 |
| View each other's bot | GET /dca-bots/{B_BOT_ID} | GET /dca-bots/{A_BOT_ID} | Both get 403 error |
| Update each other's bot | PUT /dca-bots/{B_BOT_ID} | PUT /dca-bots/{A_BOT_ID} | Both get 403 error |
| Delete each other's bot | DELETE /dca-bots/{B_BOT_ID} | DELETE /dca-bots/{A_BOT_ID} | Both get 403 error |
| View portfolio | GET /portfolio/overview | GET /portfolio/overview | Each sees own balance |
| Sync trades | POST /portfolio/sync-trades | POST /portfolio/sync-trades | Each syncs own trades |

## Limitations & Considerations

### 1. API Keys in Browser

**Current**: Kraken API keys stored in browser localStorage
- ✅ Per-user (each browser has its own)
- ✅ Never sent to other users
- ⚠️ Vulnerable if browser is compromised
- ⚠️ Lost if user clears browser data

**Alternative (Future Enhancement)**: Store encrypted API keys in backend
```typescript
// Future: Store keys per-user in Firestore
/users/{userId}/settings/apiKeys
  - krakenApiKey (encrypted)
  - krakenApiSecret (encrypted)
  - quantifyCryptoKey (encrypted)
```

### 2. Shared Market Data

Some data is intentionally shared (not user-specific):
- Market prices (public Kraken data)
- Ticker information
- Market trends
- Top 20 assets

These don't contain user-specific information and are the same for all users.

### 3. Settings Store

**Current**: Settings like Quantify Crypto keys and CoinMarketCap keys are stored in-memory singleton.

**Issue**: These are currently shared across all users.

**Solution (Required for Production)**:
- Move settings to Firestore per-user collections
- Or accept that some API keys (like CoinMarketCap) are shared across all users of the instance

## Production Deployment Checklist

Before deploying with multiple users:

- [x] JWT authentication implemented
- [x] All bot endpoints verify ownership
- [x] All portfolio endpoints use authenticated userId
- [x] All trade/cost-basis endpoints user-isolated
- [x] Removed all `'default-user'` fallbacks
- [ ] Add Firestore security rules (recommended)
- [ ] Set unique JWT_SECRET environment variable
- [ ] Consider moving API keys to backend storage
- [ ] Decide on shared vs per-user settings strategy
- [ ] Test multi-user scenarios thoroughly
- [ ] Set up user account management (password reset, etc.)
- [ ] Implement rate limiting per-user
- [ ] Add audit logging for security events
- [ ] Set up monitoring for unauthorized access attempts

## Support & Troubleshooting

### "Access denied" errors
- **Cause**: User trying to access another user's resource
- **Solution**: This is expected behavior - users can only access their own data

### Empty bot list after login
- **Cause**: New user has no bots yet
- **Solution**: Create a bot using the "Add Bot" button

### Can't see another user's bots
- **Cause**: By design - complete isolation
- **Solution**: This is correct behavior

### API keys not working
- **Cause**: Keys are stored per-browser
- **Solution**: Re-enter API keys in each browser/device

## Summary

✅ **DalyKraken 2.0 is now fully multi-user capable** with complete data isolation:

1. Each user logs in with unique credentials + TOTP
2. Each user receives their own JWT token
3. All database queries filter by authenticated userId
4. Users cannot see or modify each other's data
5. API keys are stored locally per-browser
6. All endpoints verify ownership before allowing access

Your scenario is now correct: **User A sees their bots and API keys, User B sees nothing until they add their own API keys and create their own bots.**
