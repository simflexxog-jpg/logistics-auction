# Copilot Instructions — logistics-auction

## Project Overview
Full-stack logistics auction platform with customer and partner (carrier) tiers. Angular 21 frontend, Express 5 backend,
PostgreSQL via Sequelize ORM, Socket.io for real-time bidding & location tracking, Leaflet + Turf.js
for geospatial features, JWT authentication, Docker deployment.

## Role & Tier Structure

### Role Definitions
- **CUSTOMER** (role: 'SHIPPER'): Posts loads, watches bids, awards carriers, tracks shipments, rates carriers
- **PARTNER** (role: 'CARRIER'): Browses matching loads, places bids, manages active shipments, logs location updates
- **ADMIN**: Verifies carrier profiles, manages disputes, views platform-wide analytics
- **VIEWER**: Read-only access to public data

### Tier-Specific Routes

#### Customer Features (Angular path: /customer/*)
- `/customer/post-load` → multi-step load posting wizard
- `/customer/auctions` → list of their posted auctions + bid tracker
- `/customer/auctions/:id` → live bid comparison dashboard + award button
- `/customer/shipments/:id` → shipment tracking map + document center
- `/customer/invoices` → invoice and payment summary
- `/customer/settings` → notification preferences + load templates

#### Partner/Carrier Features (Angular path: /carrier/*)
- `/carrier/loads` → available loads feed (filtered by their service lanes)
- `/carrier/bids` → my bids dashboard (live Winning/Outbid status)
- `/carrier/shipments` → active shipments board (kanban status flow)
- `/carrier/earnings` → earnings and payout summary
- `/carrier/profile` → carrier profile, document vault, verification status
- `/carrier/analytics` → lane performance analytics

## Stack & Conventions

### Frontend (Angular 21)
- Use standalone components (no NgModules unless extending existing ones)
- Angular Signals for state where possible; RxJS for HTTP and Socket.io streams
- Services in `src/app/core/services/`, components in `src/app/features/<feature>/`
- Route guards in `src/app/core/guards/` — implement CustomerGuard (role === 'SHIPPER'), CarrierGuard (role === 'CARRIER')
- Lazy-load every feature module via `loadComponent` in the router
- Each `/customer/*` and `/carrier/*` route must lazy-load its feature module
- Socket.io subscriptions live in component ngOnInit, unsubscribed in ngOnDestroy
- Leaflet map lives in shared MapComponent — never instantiate Leaflet directly in feature components
- Reusable BidTableComponent for bid comparison (used in customer and admin views)
- Bootstrap 5 + Bootstrap Icons for UI; avoid introducing new CSS frameworks

### Backend (Express 5 / Node.js)
- Separate concerns: `routes/`, `controllers/`, `services/`, `middlewares/`, `models/`
- Tier-specific routing:
  - All customer routes: `/api/customer/*` — guarded by authMiddleware + roleGuard(['SHIPPER'])
  - All carrier routes: `/api/carrier/*` — guarded by authMiddleware + roleGuard(['CARRIER'])
  - Admin routes: `/api/admin/*` — guarded by authMiddleware + roleGuard(['ADMIN'])
- All DB access goes through Sequelize models — no raw SQL unless performance-critical
- JWT middleware in `middlewares/auth.js`; RBAC middleware in `middlewares/roles.js`
- Socket.io events scoped to rooms: `auction:{auctionId}`, `shipment:{shipmentId}`, `carrier:{userId}` — never broadcast globally
- Async/await throughout; wrap all route handlers with `asyncHandler` utility
- Critical business logic must be in service layer, not route handlers

### Database
- PostgreSQL in production, SQLite in development (both via Sequelize)
- Always add `createdAt`, `updatedAt` timestamps to new models
- New columns: add as nullable or with defaults — never break existing rows
- Create a migration file for every schema change

## Key Data Models to Add

### shipments
```
- id: UUID, primaryKey
- auctionId: UUID, fk → Listing
- customerId: UUID, fk → User (shipper)
- carrierId: UUID, fk → User (carrier)
- status: ENUM('AWARDED', 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CLOSED', 'DISPUTED')
- awardedPrice: FLOAT
- pickupAt: DATE, updatedWhen status → AWARDED
- confirmedAt: DATE, updatedWhen status → PICKUP_CONFIRMED
- deliveredAt: DATE, updatedWhen status → DELIVERED
- orgId: UUID (multi-tenancy)
- createdAt, updatedAt: TIMESTAMP
```

### shipment_locations
```
- id: UUID, primaryKey
- shipmentId: UUID, fk → shipments
- lat: FLOAT, required
- lng: FLOAT, required
- timestamp: TIMESTAMP
- orgId: UUID
- createdAt: TIMESTAMP
```
Carrier pings this endpoint; Customer's Leaflet map subscribes via Socket.io to `shipment:{shipmentId}` room.

### carrier_profiles
```
- id: UUID, primaryKey
- userId: UUID, fk → User, unique
- companyName: STRING
- mcNumber: STRING (DOT/MC Number)
- dotNumber: STRING
- equipmentTypes: JSONB (array of strings: 'DRY_VAN', 'FLATBED', 'REEFER', etc.)
- fleetSize: INTEGER
- verificationStatus: ENUM('PENDING', 'VERIFIED', 'SUSPENDED')
- insuranceExpiresAt: DATE
- serviceLanes: JSONB (array of Turf.js polygon GeoJSON objects)
- avgRating: FLOAT (computed from ratings, never cached)
- totalShipments: INTEGER
- totalEarnings: FLOAT
- orgId: UUID
- createdAt, updatedAt: TIMESTAMP
```

### ratings
```
- id: UUID, primaryKey
- shipmentId: UUID, fk → shipments
- fromUserId: UUID, fk → User (rater)
- toUserId: UUID, fk → User (rated)
- score: INTEGER (1-5, validate: min 1, max 5)
- comment: TEXT
- orgId: UUID
- createdAt, updatedAt: TIMESTAMP
```
Rule: Only one rating per shipment, must submit after status = 'DELIVERED'.

### load_templates
```
- id: UUID, primaryKey
- userId: UUID, fk → User
- name: STRING
- templateData: JSONB (mirrors POST /api/customer/post-load body)
- orgId: UUID
- createdAt, updatedAt: TIMESTAMP
```
Load templates belong to the user who created them — never queryable across users.

### carrier_documents
```
- id: UUID, primaryKey
- carrierId: UUID, fk → carrier_profiles
- docType: ENUM('INSURANCE', 'W9', 'AUTHORITY', 'BOL')
- fileUrl: STRING
- expiresAt: DATE (nullable for docs that don't expire)
- orgId: UUID
- createdAt, updatedAt: TIMESTAMP
```

### invoices
```
- id: UUID, primaryKey
- shipmentId: UUID, fk → shipments
- customerId: UUID, fk → User
- carrierId: UUID, fk → User
- amount: FLOAT
- status: ENUM('PENDING', 'PAID', 'DISPUTED')
- issuedAt: TIMESTAMP
- paidAt: TIMESTAMP (nullable until paid)
- orgId: UUID
- createdAt, updatedAt: TIMESTAMP
```

## Business Rules to Enforce in Code

1. **Bidding Rules**
   - A carrier cannot bid on an auction if their `verificationStatus !== 'VERIFIED'`
   - A carrier's bid must be >= the current minimum bid (if any)
   - A carrier cannot bid on an auction if the auction is not in 'open' status
   - Reject bids if auction has ended (`auctionEndsAt < now()`)

2. **Award & Shipment Creation**
   - A customer can only award an auction that is in 'OPEN' status with ≥1 bid
   - Award action transitions Listing.status → 'CLOSED' and creates a new Shipment with status='AWARDED'
   - Only the customer who posted the listing can award it

3. **Shipment State Machine**
   - Valid transitions: AWARDED → PICKUP_CONFIRMED → IN_TRANSIT → DELIVERED → CLOSED
   - DELIVERED → DISPUTED (dispute path)
   - Invalid transitions must return 400 with clear error message
   - Only carrier can update status PICKUP_CONFIRMED → IN_TRANSIT
   - Only carrier can update to DELIVERED (with proof of delivery)
   - Only customer or admin can move to DISPUTED

4. **Location Tracking**
   - Location pings only accepted if shipment status is 'IN_TRANSIT'
   - Carrier can only ping locations for their own active shipments
   - Location pings emit 'shipment:location' event to room `shipment:{shipmentId}`

5. **Ratings**
   - Ratings can only be submitted once per shipment, after status = 'DELIVERED'
   - Both customer and carrier can rate each other on the same shipment
   - Score must be 1-5
   - A user cannot rate themselves
   - Carrier's avgRating is always computed from ratings table (SELECT AVG(score) WHERE toUserId = carrerId)

6. **Visibility & Filtering**
   - Do not let a carrier see other carriers' bid amounts — only show their own bid and current lowest
   - Carriers only see loads that match their serviceLanes (use Turf.js `booleanPointInPolygon` to filter)
   - Customers only see their own posts, shipments, templates
   - Do not hard-code role strings — import from a shared ROLES constant

## Database

### Enterprise Features Being Added
- RBAC: roles are ADMIN, CARRIER, SHIPPER, VIEWER
- Refresh token table: `refresh_tokens (id, userId, token, expiresAt, revokedAt)`
- Audit log: write to `audit_logs (id, userId, action, entity, entityId, metadata, createdAt)` on every state-changing operation
- Redis for Socket.io scaling and query caching via ioredis
- Rate limiting via express-rate-limit on /api/bids and /api/auth routes
- Helmet.js already installed; keep all security headers intact
- Multi-tenancy: every new table must include `orgId` FK — scope all queries by tenant

### What NOT to do
- Do not use `any` in TypeScript — be explicit with interfaces/types
- Do not emit Socket.io events without room scoping
- Do not put business logic in route handlers — put it in service files
- Do not introduce new authentication libraries — extend the existing JWT system
- Do not create new DB tables without a corresponding Sequelize migration
- Do not remove or rename existing API endpoints — only add new ones
- **Do not put award logic in the Angular component** — it must go through the API
- **Do not store carrier location in the carriers table** — always use shipment_locations
- **Do not let a carrier see other carriers' bid amounts** — only show their own bid and current lowest
- **Do not hard-code role strings** — import from a shared ROLES constant
- **Do not skip the state machine check on shipment status updates** — invalid transitions must return 400

### File Naming
- Angular: `kebab-case.component.ts`, `kebab-case.service.ts`
- Express: `camelCase.routes.js`, `camelCase.controller.js`, `camelCase.service.js`
- Models: `PascalCase.model.js`

### Testing
- Vitest for Angular unit tests
- New Express routes must have at least a happy-path integration test
- Use `supertest` for backend route testing

## Socket.io Room Naming

- `auction:{auctionId}` → bid updates, auction close, award notification
- `shipment:{shipmentId}` → location updates, status changes
- `carrier:{userId}` → new matching load alerts for this carrier

Example events:
- `auction:{auctionId}` emits: `bid:updated`, `bid:new`, `auction:awarded`, `auction:closed`
- `shipment:{shipmentId}` emits: `shipment:location`, `shipment:status`
- `carrier:{userId}` emits: `load:match` (new load matches their service lanes)

## Key API Routes (Tier-Specific)

### Customer Routes (`/api/customer/*`)
- `POST /api/customer/post-load` → Create a new auction/listing
- `GET /api/customer/auctions` → List their posted auctions
- `GET /api/customer/auctions/:id` → Get auction with live bids
- `POST /api/customer/auctions/:id/award` → Award auction to winning bid → creates Shipment
- `GET /api/customer/shipments` → List their shipments
- `GET /api/customer/shipments/:id` → Get shipment with tracking
- `POST /api/customer/shipments/:id/rate` → Submit rating for delivered shipment
- `GET /api/customer/invoices` → List invoices
- `GET /api/customer/settings` → Get notification preferences + templates
- `POST /api/customer/templates` → Save a load template
- `DELETE /api/customer/templates/:id` → Delete template

### Carrier Routes (`/api/carrier/*`)
- `GET /api/carrier/loads` → Available loads feed (filtered by service lanes)
- `POST /api/carrier/bids` → Place a bid (already exists, add lane filtering)
- `GET /api/carrier/bids` → List their own bids with win/outbid status
- `GET /api/carrier/shipments` → Kanban board view of active shipments
- `PATCH /api/carrier/shipments/:id/status` → Update shipment status (with state machine)
- `POST /api/carrier/shipments/:id/location` → Ping location update
- `GET /api/carrier/profile` → Get their carrier profile
- `PUT /api/carrier/profile` → Update profile, service lanes, equipment types
- `POST /api/carrier/documents` → Upload carrier document (insurance, W9, etc.)
- `GET /api/carrier/earnings` → Earnings summary and payouts
- `GET /api/carrier/analytics` → Lane performance data
- `POST /api/carrier/shipments/:id/rate` → Submit rating for customer

## Example Patterns

### Award Auction & Create Shipment (customer endpoint)
```js
// routes/customer.routes.js
const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roles');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { auctionService } = require('../services/auctionService');

router.post('/:auctionId/award', 
  auth, 
  roleGuard(['SHIPPER']),
  auditLog('UPDATE', 'Listing'),
  asyncHandler(async (req, res) => {
    const { auctionId } = req.params;
    const { winningBidId } = req.body;

    // Service handles business logic and state machine
    const shipment = await auctionService.awardAuction(
      auctionId,
      winningBidId,
      req.user.id,
      req.orgId
    );

    // Emit socket event
    req.app.get('io').to(`auction:${auctionId}`).emit('auction:awarded', {
      auctionId,
      shipmentId: shipment.id,
      carrierId: shipment.carrierId,
      awardedPrice: shipment.awardedPrice
    });

    res.status(201).json(shipment);
  })
);

// services/auctionService.js
exports.awardAuction = async (auctionId, winningBidId, customerId, orgId) => {
  const listing = await Listing.findByPk(auctionId);
  if (!listing) throw new Error('Listing not found');
  if (listing.customerId !== customerId) throw new Error('Not your listing');
  if (listing.status !== 'open') throw new Error('Auction not open');

  const bid = await Bid.findByPk(winningBidId);
  if (!bid || bid.listingId !== auctionId) throw new Error('Bid not found');

  // Create shipment in AWARDED state
  const shipment = await Shipment.create({
    auctionId,
    customerId,
    carrierId: bid.partnerId,
    awardedPrice: bid.amount,
    status: 'AWARDED',
    orgId
  });

  // Update listing to CLOSED
  await listing.update({ status: 'CLOSED', winnerId: bid.partnerId, winningBid: bid.amount });

  return shipment;
};
```

### Shipment Status Update with State Machine (carrier endpoint)
```js
// routes/carrier.routes.js
router.patch('/:shipmentId/status',
  auth,
  roleGuard(['CARRIER']),
  auditLog('UPDATE', 'Shipment'),
  asyncHandler(async (req, res) => {
    const { shipmentId } = req.params;
    const { status } = req.body;

    const shipment = await shipmentService.updateStatus(
      shipmentId,
      status,
      req.user.id,
      req.orgId
    );

    // Emit socket event
    req.app.get('io').to(`shipment:${shipmentId}`).emit('shipment:status', {
      shipmentId,
      status: shipment.status,
      timestamp: new Date()
    });

    res.json(shipment);
  })
);

// services/shipmentService.js
const STATE_MACHINE = {
  'AWARDED': ['PICKUP_CONFIRMED'],
  'PICKUP_CONFIRMED': ['IN_TRANSIT'],
  'IN_TRANSIT': ['DELIVERED'],
  'DELIVERED': ['CLOSED', 'DISPUTED'],
  'CLOSED': [],
  'DISPUTED': ['CLOSED']
};

exports.updateStatus = async (shipmentId, newStatus, carrierId, orgId) => {
  const shipment = await Shipment.findByPk(shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  if (shipment.carrierId !== carrierId) throw new Error('Not your shipment');

  const validTransitions = STATE_MACHINE[shipment.status] || [];
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Cannot transition from ${shipment.status} to ${newStatus}`);
  }

  // Update timestamp based on new status
  const updates = { status: newStatus };
  if (newStatus === 'PICKUP_CONFIRMED') updates.confirmedAt = new Date();
  if (newStatus === 'DELIVERED') updates.deliveredAt = new Date();

  await shipment.update(updates);
  return shipment;
};
```

### Carrier Profile with Service Lanes (Turf.js GeoJSON polygons)
```js
// routes/carrier.routes.js
router.put('/profile',
  auth,
  roleGuard(['CARRIER']),
  auditLog('UPDATE', 'CarrierProfile'),
  asyncHandler(async (req, res) => {
    const { companyName, mcNumber, equipmentTypes, serviceLanes } = req.body;

    let profile = await CarrierProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      profile = await CarrierProfile.create({
        userId: req.user.id,
        orgId: req.orgId
      });
    }

    await profile.update({
      companyName,
      mcNumber,
      equipmentTypes, // ['DRY_VAN', 'FLATBED', 'REEFER']
      serviceLanes   // [{ type: 'Polygon', coordinates: [...] }, ...]
    });

    res.json(profile);
  })
);

// services/loadService.js - filter by service lanes
const turf = require('@turf/turf');

exports.getAvailableLoads = async (carrierId, orgId) => {
  const carrier = await CarrierProfile.findOne({ where: { userId: carrierId } });
  const allLoads = await Listing.findAll({
    where: { status: 'open', orgId }
  });

  // Filter loads within carrier's service lanes
  const matchingLoads = allLoads.filter(load => {
    const loadPoint = turf.point([load.pickupLng, load.pickupLat]);
    
    return carrier.serviceLanes.some(lane => {
      try {
        return turf.booleanPointInPolygon(loadPoint, lane);
      } catch (e) {
        return false;
      }
    });
  });

  return matchingLoads;
};
```

### Adding New Express Route (correct pattern)
```js
// routes/notification.routes.js
router.post('/', 
  auth, 
  roleGuard(['ADMIN', 'SHIPPER']), 
  asyncHandler(notificationController.create)
);

// controllers/notification.controller.js
exports.create = async (req, res) => {
  const result = await notificationService.create(req.body, req.user, req.orgId);
  res.status(201).json(result);
};
```

### Adding a new Angular feature (correct pattern)
```ts
// Lazy-loaded route
{ path: 'notifications', loadComponent: () => import('./features/notifications/notifications.component') }
```
