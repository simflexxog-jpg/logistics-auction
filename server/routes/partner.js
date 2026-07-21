const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { User, Listing, Bid, Payment, Rating } = require('../models');

// Dashboard stats
router.get('/dashboard', auth, requireRole('partner'), async (req, res) => {
  try {
    const partner = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    const myBids = await Bid.count({ where: { partnerId: req.user.id } });
    const wonBids = await Bid.count({ where: { partnerId: req.user.id, status: 'accepted' } });
    const activeShipments = await Listing.count({ where: { winnerId: req.user.id, status: 'in_transit' } });
    const completedShipments = await Listing.count({ where: { winnerId: req.user.id, status: 'delivered' } });
    const recentJobs = await Listing.findAll({
      where: { winnerId: req.user.id },
      order: [['updatedAt', 'DESC']],
      limit: 5
    });
    res.json({ partner, myBids, wonBids, activeShipments, completedShipments, recentJobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get partner profile (public)
router.get('/:id', auth, async (req, res) => {
  try {
    const partner = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'truckType', 'truckCapacity', 'avgRating', 'totalRatings', 'totalEarnings'],
      include: [{ model: Rating, as: null }]
    });
    res.json(partner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
