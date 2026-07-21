const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Payment, Listing, User } = require('../models');
const { v4: uuidv4 } = require('crypto');

// Process payment (customer only)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const { listingId, method = 'card' } = req.body;
    const listing = await Listing.findByPk(listingId);
    if (!listing || listing.customerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'accepted') return res.status(400).json({ error: 'Bid not accepted yet' });

    const existing = await Payment.findOne({ where: { listingId } });
    if (existing && existing.status === 'completed') return res.status(400).json({ error: 'Already paid' });

    // Simulate payment processing
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const payment = await Payment.create({
      listingId,
      customerId: req.user.id,
      partnerId: listing.winnerId,
      amount: listing.winningBid,
      status: 'completed',
      transactionId,
      method
    });

    // Update partner earnings
    await User.increment('totalEarnings', { by: listing.winningBid, where: { id: listing.winnerId } });
    await listing.update({ status: 'in_transit' });

    res.json({ payment, message: 'Payment successful! You can now chat with your partner.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment for listing
router.get('/listing/:listingId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({ where: { listingId: req.params.listingId } });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
