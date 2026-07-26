const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { customerGuard } = require('../middleware/tierGuards');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const {
  Listing,
  Shipment,
  LoadTemplate,
  Invoice
} = require('../models');
const auctionService = require('../services/auctionService');
const shipmentService = require('../services/shipmentService');
const { AUCTION_STATUS } = require('../constants');

/**
 * POST /api/customer/post-load
 * Create a new auction/load posting
 */
router.post('/post-load',
  auth,
  customerGuard,
  auditLog('CREATE', 'Listing'),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      cargoType,
      weight,
      dimensions,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      auctionEndsAt
    } = req.body;

    const listing = await Listing.create({
      customerId: req.user.id,
      title,
      description,
      cargoType,
      weight,
      dimensions,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      auctionEndsAt,
      status: AUCTION_STATUS.OPEN,
      orgId: req.orgId
    });

    res.status(201).json(listing);
  })
);

/**
 * GET /api/customer/auctions
 * List customer's posted auctions
 */
router.get('/auctions',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const where = { customerId: req.user.id };
    if (req.orgId) where.orgId = req.orgId;

    const listings = await Listing.findAll({
      where,
      include: [
        {
          association: 'bids',
          include: [{ association: 'partner', attributes: ['id', 'name', 'avgRating'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(listings);
  })
);

/**
 * GET /api/customer/auctions/:id
 * Get auction detail with bid comparison
 */
router.get('/auctions/:id',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const listing = await auctionService.getAuctionWithBids(req.params.id, req.orgId);

    // Authorization: only customer who posted can view
    if (listing.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(listing);
  })
);

/**
 * POST /api/customer/auctions/:id/award
 * Award auction to winning bid
 */
router.post('/auctions/:id/award',
  auth,
  customerGuard,
  auditLog('UPDATE', 'Listing'),
  asyncHandler(async (req, res) => {
    const { winningBidId } = req.body;

    const shipment = await auctionService.awardAuction(
      req.params.id,
      winningBidId,
      req.user.id,
      req.orgId
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`auction:${req.params.id}`).emit('auction:awarded', {
        auctionId: req.params.id,
        shipmentId: shipment.id,
        carrierId: shipment.carrierId,
        awardedPrice: shipment.awardedPrice
      });
    }

    res.status(201).json(shipment);
  })
);

/**
 * GET /api/customer/shipments
 * List customer's shipments
 */
router.get('/shipments',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const shipments = await shipmentService.getShipmentsByCustomer(req.user.id, req.orgId);
    res.json(shipments);
  })
);

/**
 * GET /api/customer/shipments/:id
 * Get shipment detail with tracking
 */
router.get('/shipments/:id',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const shipment = await shipmentService.getShipmentDetail(req.params.id, req.user.id, req.orgId);
    res.json(shipment);
  })
);

/**
 * POST /api/customer/shipments/:id/rate
 * Submit rating for delivered shipment
 */
router.post('/shipments/:id/rate',
  auth,
  customerGuard,
  auditLog('CREATE', 'Rating'),
  asyncHandler(async (req, res) => {
    const { score, comment } = req.body;
    const { Rating, Shipment } = require('../models');

    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    // Authorization
    if (shipment.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only rate after delivered
    if (shipment.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'Shipment not yet delivered' });
    }

    // Check if already rated
    const existing = await Rating.findOne({
      where: { shipmentId: req.params.id, fromUserId: req.user.id }
    });
    if (existing) return res.status(400).json({ error: 'Already rated' });

    const rating = await Rating.create({
      shipmentId: req.params.id,
      fromUserId: req.user.id,
      toUserId: shipment.carrierId,
      score,
      comment,
      orgId: req.orgId
    });

    res.status(201).json(rating);
  })
);

/**
 * GET /api/customer/invoices
 * List invoices
 */
router.get('/invoices',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const where = { customerId: req.user.id };
    if (req.orgId) where.orgId = req.orgId;

    const invoices = await Invoice.findAll({
      where,
      include: [
        { association: 'shipment' }
      ],
      order: [['issuedAt', 'DESC']]
    });

    res.json(invoices);
  })
);

/**
 * GET /api/customer/templates
 * List load templates
 */
router.get('/templates',
  auth,
  customerGuard,
  asyncHandler(async (req, res) => {
    const where = { userId: req.user.id };
    if (req.orgId) where.orgId = req.orgId;

    const templates = await LoadTemplate.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(templates);
  })
);

/**
 * POST /api/customer/templates
 * Save a load template
 */
router.post('/templates',
  auth,
  customerGuard,
  auditLog('CREATE', 'LoadTemplate'),
  asyncHandler(async (req, res) => {
    const { name, templateData } = req.body;

    const template = await LoadTemplate.create({
      userId: req.user.id,
      name,
      templateData,
      orgId: req.orgId
    });

    res.status(201).json(template);
  })
);

/**
 * DELETE /api/customer/templates/:id
 * Delete a template
 */
router.delete('/templates/:id',
  auth,
  customerGuard,
  auditLog('DELETE', 'LoadTemplate'),
  asyncHandler(async (req, res) => {
    const template = await LoadTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Authorization
    if (template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await template.destroy();
    res.json({ message: 'Template deleted' });
  })
);

module.exports = router;
