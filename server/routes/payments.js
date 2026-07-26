const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Payment, Listing, User, Bid } = require('../models');

// Process payment (customer only)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const { listingId, method = 'card' } = req.body;
    const listing = await Listing.findByPk(listingId);
    if (!listing || listing.customerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (!['accepted', 'paid'].includes(listing.status)) return res.status(400).json({ error: 'Bid not accepted yet' });

    const existing = await Payment.findOne({ where: { listingId } });
    if (existing && existing.status === 'completed') return res.status(400).json({ error: 'Already paid' });

    const acceptedBid = await Bid.findOne({ where: { listingId, status: 'accepted' } });
    const partnerId = listing.winnerId || acceptedBid?.partnerId;
    const winningAmount = listing.winningBid || acceptedBid?.amount;

    if (!partnerId || !winningAmount) {
      return res.status(400).json({ error: 'No accepted bid found for this listing yet.' });
    }

    // Simulate payment processing
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const payment = await Payment.create({
      listingId,
      customerId: req.user.id,
      partnerId,
      amount: winningAmount,
      status: 'completed',
      transactionId,
      method
    });

    // Update partner earnings
    await User.increment('totalEarnings', { by: winningAmount, where: { id: partnerId } });
    await listing.update({ status: 'paid', winnerId: partnerId, winningBid: winningAmount });

    res.json({ payment, message: 'Payment successful! You can now chat with your partner.' });
  } catch (err) {
    console.error('Payment processing failed:', err && err.message ? err.message : err);
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
