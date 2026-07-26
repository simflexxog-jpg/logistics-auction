# Enterprise Features Implementation Guide

## Overview
This document describes the enterprise features implemented in the logistics-auction platform to support scaling, security, multi-tenancy, and compliance.

## Features Implemented

### 1. RBAC (Role-Based Access Control)

#### New Roles
- `ADMIN` - Full system access
- `CARRIER` - Logistics carrier (equivalent to partner)
- `SHIPPER` - Shipper (equivalent to customer)
- `VIEWER` - Read-only access
- `customer` - Legacy support
- `partner` - Legacy support

#### Usage

```javascript
// Using the roleGuard middleware
const { roleGuard } = require('../middleware/roles');

// Single role check
router.get('/admin-panel', auth, roleGuard(['ADMIN']), handler);

// Multiple roles (user needs at least one)
router.post('/bid', auth, roleGuard(['partner', 'CARRIER']), handler);

// No role restriction (authenticated users only)
router.get('/profile', auth, roleGuard([]), handler);
```

### 2. Refresh Tokens

#### Purpose
- Support token rotation for enhanced security
- Allow graceful token expiry without forcing re-authentication
- Ability to revoke tokens

#### Database Model
```
RefreshToken
  id: UUID (primary key)
  userId: UUID (foreign key)
  token: TEXT (JWT)
  expiresAt: DATE
  revokedAt: DATE (nullable - null = active)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
```

#### API Usage

**Login Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { ... }
}
```

**Refresh Token Endpoint:**
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Logout (Revoke Token):**
```bash
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

#### Environment Variables
```
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_secret_key
REFRESH_TOKEN_EXPIRY=30  # days
```

### 3. Audit Logging

#### Purpose
- Track all state-changing operations (CREATE, UPDATE, DELETE)
- Maintain compliance and debugging records
- Understand system changes over time

#### Database Model
```
AuditLog
  id: UUID (primary key)
  userId: UUID (nullable - nullable for system actions)
  action: STRING (CREATE, UPDATE, DELETE)
  entity: STRING (table name: Listing, Bid, Payment, etc.)
  entityId: UUID (nullable - the record that was changed)
  metadata: JSON (additional context)
  orgId: UUID (nullable - multi-tenancy)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
```

#### Usage

```javascript
const { auditLog } = require('../middleware/auditLog');

// Log creation of Bid
router.post('/', auth, auditLog('CREATE', 'Bid'), handler);

// With custom entity ID extraction
router.post('/', auth, auditLog('UPDATE', 'Listing', (req, data) => data.listingId), handler);
```

#### Audit Log Entry Example
```json
{
  "userId": "user-123",
  "action": "CREATE",
  "entity": "Bid",
  "entityId": "bid-456",
  "metadata": {
    "method": "POST",
    "path": "/api/bids",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1",
    "requestBody": { "listingId": "...", "amount": 5000 }
  },
  "orgId": "org-789",
  "createdAt": "2026-07-26T10:30:00Z"
}
```

### 4. Rate Limiting

#### Limiters Configured

**Authentication Limiter** (`/api/auth` routes)
- **Window**: 15 minutes
- **Max**: 5 requests per window
- **Key**: Email or IP address

**Bid Limiter** (`/api/bids` routes)
- **Window**: 1 minute
- **Max**: 10 bids per minute
- **Key**: User ID (from req.user)

**General API Limiter** (all API routes)
- **Window**: 15 minutes
- **Max**: 100 requests per window
- **Key**: IP address

#### Usage

```javascript
const { authLimiter, bidLimiter, apiLimiter } = require('../middleware/rateLimit');

// Applied globally in server/index.js
app.use(apiLimiter);

// Applied per route
router.post('/', auth, bidLimiter, handler);
router.post('/login', authLimiter, handler);
```

#### Response Headers
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1626345600
```

### 5. Redis Integration

#### Purpose
- Query result caching
- Socket.io adapter for distributed sessions
- Session management

#### Configuration

```javascript
const { redis, cache } = require('./utils/redis');

// Environment variables
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
```

#### Cache API

```javascript
const { cache } = require('./utils/redis');

// Get
const user = await cache.get('user:123');

// Set (with 1 hour TTL)
await cache.set('user:123', userData, 3600);

// Delete
await cache.del('user:123');

// Clear all
await cache.clear();
```

#### Example: Caching User Profile

```javascript
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const cacheKey = `user:${req.user.id}:profile`;
  
  // Try cache first
  let profile = await cache.get(cacheKey);
  if (profile) {
    return res.json(profile);
  }

  // Get from DB
  const user = await User.findByPk(req.user.id);
  
  // Cache for 1 hour
  await cache.set(cacheKey, user, 3600);
  
  res.json(user);
}));
```

### 6. Multi-Tenancy

#### Purpose
- Support multiple organizations/tenants in a single deployment
- Automatic data isolation
- Scope queries by tenant

#### Implementation

**Added to All Models:**
```javascript
orgId: { type: DataTypes.UUID } // Optional - null = default/global
```

**Models Updated:**
- User
- Listing
- Bid
- Payment
- Rating
- AddOn
- AuditLog

#### Usage

```javascript
// Query scoped to tenant
const listings = await Listing.findAll({
  where: { 
    customerId: req.user.id,
    orgId: req.orgId  // Multi-tenancy filter
  }
});

// orgId attached to request by auth middleware
// req.orgId available for all authenticated requests
```

#### Best Practices

1. **Always scope queries by `orgId`:**
   ```javascript
   where: { ..., orgId: req.orgId }
   ```

2. **Always set `orgId` on create:**
   ```javascript
   await Model.create({ 
     ...data, 
     orgId: req.orgId 
   });
   ```

3. **Check orgId on sensitive operations:**
   ```javascript
   if (req.orgId && record.orgId && req.orgId !== record.orgId) {
     return res.status(403).json({ error: 'Access denied' });
   }
   ```

### 7. Helmet Security Headers

#### Purpose
- Add HTTP security headers
- Protect against common vulnerabilities (XSS, Clickjacking, etc.)

#### Enabled Headers
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Strict-Transport-Security` (production)

#### Usage
```javascript
const helmet = require('helmet');

app.use(helmet());
```

### 8. AsyncHandler Utility

#### Purpose
- Wrap async route handlers
- Automatically catch Promise rejections
- Pass errors to Express error handling middleware

#### Usage

```javascript
const asyncHandler = require('../utils/asyncHandler');

// Before (prone to unhandled rejection warnings)
router.get('/users/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  res.json(user);
});

// After (safe)
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  res.json(user);
}));
```

## Best Practices for New Routes

### Template for New Route Handler

```javascript
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roles');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { Model } = require('../models');

// Create
router.post('/', 
  auth,
  roleGuard(['ADMIN', 'SHIPPER']),
  auditLog('CREATE', 'Model'),
  asyncHandler(async (req, res) => {
    const record = await Model.create({
      ...req.body,
      orgId: req.orgId  // Multi-tenancy
    });
    res.status(201).json(record);
  })
);

// Read (list with tenant scoping)
router.get('/', 
  auth,
  roleGuard(['ADMIN', 'SHIPPER', 'VIEWER']),
  asyncHandler(async (req, res) => {
    const records = await Model.findAll({
      where: { orgId: req.orgId }
    });
    res.json(records);
  })
);

// Read (single)
router.get('/:id', 
  auth,
  asyncHandler(async (req, res) => {
    const record = await Model.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    
    // Multi-tenancy check
    if (req.orgId && record.orgId && req.orgId !== record.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(record);
  })
);

// Update
router.put('/:id',
  auth,
  roleGuard(['ADMIN', 'SHIPPER']),
  auditLog('UPDATE', 'Model'),
  asyncHandler(async (req, res) => {
    const record = await Model.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    
    // Multi-tenancy check
    if (req.orgId && record.orgId && req.orgId !== record.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await record.update(req.body);
    res.json(record);
  })
);

// Delete
router.delete('/:id',
  auth,
  roleGuard(['ADMIN']),
  auditLog('DELETE', 'Model'),
  asyncHandler(async (req, res) => {
    const record = await Model.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    
    // Multi-tenancy check
    if (req.orgId && record.orgId && req.orgId !== record.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await record.destroy();
    res.json({ message: 'Deleted' });
  })
);

module.exports = router;
```

## Testing the Features

### 1. Test RBAC
```bash
# Try accessing admin route without ADMIN role
curl -X GET http://localhost:3000/api/admin/panel \
  -H "Authorization: Bearer <customer_token>"
# Expected: 403 Access denied
```

### 2. Test Refresh Token
```bash
# Login and get tokens
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

### 3. Test Rate Limiting
```bash
# Make requests until rate limited
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/bids \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"listingId":"...","amount":5000}'
done
# Expected: 429 Too Many Requests after 10 attempts
```

### 4. Test Audit Logging
```bash
# Create a listing
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Check audit logs
curl -X GET http://localhost:3000/api/admin/audit-logs \
  -H "Authorization: Bearer <admin_token>"
```

## Migration for Existing Routes

To update existing routes to use the new features:

1. Add `asyncHandler` wrapper:
   ```javascript
   // OLD
   router.post('/', auth, async (req, res) => { ... });
   
   // NEW
   router.post('/', auth, asyncHandler(async (req, res) => { ... }));
   ```

2. Replace `requireRole` with `roleGuard`:
   ```javascript
   // OLD
   router.post('/', auth, requireRole('partner'), handler);
   
   // NEW
   router.post('/', auth, roleGuard(['partner', 'CARRIER']), handler);
   ```

3. Add rate limiting where needed:
   ```javascript
   const { bidLimiter } = require('../middleware/rateLimit');
   router.post('/', auth, bidLimiter, handler);
   ```

4. Add audit logging for state changes:
   ```javascript
   const { auditLog } = require('../middleware/auditLog');
   router.post('/', auth, auditLog('CREATE', 'Entity'), handler);
   ```

5. Scope queries to tenant:
   ```javascript
   where: { customerId: req.user.id, orgId: req.orgId }
   ```

## Troubleshooting

### Redis Connection Issues
- Check if Redis is running: `redis-cli ping`
- If not available, the system continues without caching (with warning logs)

### Token Expiry Errors
- Ensure `JWT_SECRET` and `REFRESH_TOKEN_SECRET` are set
- Ensure refresh token is not revoked: check `revokedAt` in database

### Multi-Tenancy Not Working
- Verify `orgId` is set when creating records
- Verify queries include `orgId` filter
- Check `req.orgId` is available (from auth middleware)

### Rate Limiting False Positives
- Check rate limit headers in response
- Increase limits in `rateLimit.js` if needed for development

## Future Enhancements

1. **API Key Management** - Support API key authentication for integrations
2. **Webhook System** - Trigger webhooks on audit log events
3. **Advanced Caching** - Cache invalidation strategies
4. **Rate Limit Dashboard** - Monitor rate limit usage per user
5. **Encryption at Rest** - Encrypt sensitive data in database
6. **IP Whitelisting** - Restrict API access to whitelisted IPs
