const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { AddOn, Listing } = require('../models');

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Distance from point to line segment (returns km)
function pointToSegmentDistance(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLat - aLat, dy = bLng - aLng;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return haversine(pLat, pLng, aLat, aLng);
  let t = ((pLat - aLat)*dx + (pLng - aLng)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return haversine(pLat, pLng, aLat + t*dx, aLng + t*dy);
}

// Get all open add-ons
router.get('/', auth, async (req, res) => {
  try {
    const where = req.user.role === 'customer' ? { customerId: req.user.id } : { status: 'open' };
    const addons = await AddOn.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(addons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post an add-on (customer)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const addon = await AddOn.create({ ...req.body, customerId: req.user.id });
    res.status(201).json(addon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Claim an add-on (partner) — validates 2km route deviation
router.post('/:id/claim', auth, requireRole('partner'), async (req, res) => {
  try {
    const addon = await AddOn.findByPk(req.params.id);
    if (!addon || addon.status !== 'open') return res.status(400).json({ error: 'Not available' });

    const { listingId } = req.body;
    const listing = await Listing.findByPk(listingId);
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not your shipment' });

    // Check 2km deviation
    const pickupDist = pointToSegmentDistance(addon.pickupLat, addon.pickupLng, listing.pickupLat, listing.pickupLng, listing.dropoffLat, listing.dropoffLng);
    const dropoffDist = pointToSegmentDistance(addon.dropoffLat, addon.dropoffLng, listing.pickupLat, listing.pickupLng, listing.dropoffLat, listing.dropoffLng);

    if (pickupDist > 2 || dropoffDist > 2) {
      return res.status(400).json({
        error: `Deviation exceeds 2km limit. Pickup: ${pickupDist.toFixed(2)}km, Dropoff: ${dropoffDist.toFixed(2)}km off route.`
      });
    }

    await addon.update({ status: 'claimed', partnerId: req.user.id, mainListingId: listingId });
    res.json(addon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
