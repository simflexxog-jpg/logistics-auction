const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { carrierGuard } = require('../middleware/tierGuards');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { Bid, Listing, Shipment, CarrierProfile } = require('../models');
const carrierService = require('../services/carrierService');
const auctionService = require('../services/auctionService');
const shipmentService = require('../services/shipmentService');

// GET /api/carrier/loads
router.get('/loads', auth, carrierGuard, asyncHandler(async (req, res) => {
  const loads = await carrierService.getAvailableLoads(req.user.id, req.orgId);
  res.json(loads);
}));

// POST /api/carrier/bids
router.post('/bids', auth, carrierGuard, auditLog('CREATE', 'Bid'), asyncHandler(async (req, res) => {
  const { listingId, amount, notes } = req.body;
  const listing = await Listing.findByPk(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Auction is not open' });

  await auctionService.validateCarrierCanBid(req.user.id, req.orgId);

  const bid = await Bid.create({
    listingId,
    partnerId: req.user.id,
    amount,
    notes,
    status: 'pending',
    orgId: req.orgId
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`auction:${listingId}`).emit('auction:new-bid', { listingId, bidId: bid.id, amount, partnerId: req.user.id });
  }

  res.status(201).json(bid);
}));

// GET /api/carrier/bids
router.get('/bids', auth, carrierGuard, asyncHandler(async (req, res) => {
  const where = { partnerId: req.user.id };
  if (req.orgId) where.orgId = req.orgId;

  const bids = await Bid.findAll({ where, include: [{ association: 'listing' }] });
  res.json(bids);
}));

// GET /api/carrier/shipments
router.get('/shipments', auth, carrierGuard, asyncHandler(async (req, res) => {
  const shipments = await shipmentService.getShipmentsByCarrier(req.user.id, req.orgId);
  res.json(shipments);
}));

// PATCH /api/carrier/shipments/:id/status
router.patch('/shipments/:id/status', auth, carrierGuard, auditLog('UPDATE', 'Shipment'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const shipment = await shipmentService.updateStatus(req.params.id, status, req.user.id, req.orgId);

  const io = req.app.get('io');
  if (io) {
    io.to(`shipment:${req.params.id}`).emit('shipment:status-updated', { shipmentId: req.params.id, status });
  }

  res.json(shipment);
}));

// POST /api/carrier/shipments/:id/location
router.post('/shipments/:id/location', auth, carrierGuard, auditLog('CREATE', 'ShipmentLocation'), asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const location = await shipmentService.addLocation(req.params.id, lat, lng, req.user.id, req.orgId);

  const io = req.app.get('io');
  if (io) {
    io.to(`shipment:${req.params.id}`).emit('shipment:location-updated', { shipmentId: req.params.id, lat, lng, timestamp: location.timestamp });
    io.to(`carrier:${req.user.id}`).emit('carrier:location-ping', { shipmentId: req.params.id, lat, lng });
  }

  res.status(201).json(location);
}));

// GET /api/carrier/profile
router.get('/profile', auth, carrierGuard, asyncHandler(async (req, res) => {
  const profile = await carrierService.getCarrierProfile(req.user.id, req.orgId);
  res.json(profile);
}));

// PUT /api/carrier/profile
router.put('/profile', auth, carrierGuard, auditLog('UPDATE', 'CarrierProfile'), asyncHandler(async (req, res) => {
  const profile = await carrierService.updateCarrierProfile(req.user.id, req.body, req.orgId);
  res.json(profile);
}));

// GET /api/carrier/earnings
router.get('/earnings', auth, carrierGuard, asyncHandler(async (req, res) => {
  const earnings = await carrierService.getCarrierEarnings(req.user.id, req.orgId);
  res.json(earnings);
}));

// GET /api/carrier/analytics
router.get('/analytics', auth, carrierGuard, asyncHandler(async (req, res) => {
  const analytics = await carrierService.getCarrierAnalytics(req.user.id, req.orgId);
  res.json(analytics);
}));

module.exports = router;
