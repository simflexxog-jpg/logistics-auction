const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { ChatMessage, Listing } = require('../models');

// Get chat history for a listing
router.get('/:listingId', auth, async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Not found' });
    // Only customer or winning partner can access chat
    if (req.user.id !== listing.customerId && req.user.id !== listing.winnerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const messages = await ChatMessage.findAll({
      where: { listingId: req.params.listingId },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send message
router.post('/:listingId', auth, async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (req.user.id !== listing.customerId && req.user.id !== listing.winnerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const msg = await ChatMessage.create({
      listingId: req.params.listingId,
      senderId: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: req.body.message
    });

    req.app.get('io')?.to(`chat:${req.params.listingId}`).emit('chat:message', msg);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
