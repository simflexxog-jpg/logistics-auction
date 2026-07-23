const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Listing } = require('../models');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.dev/v1/completions';

router.post('/assistant/:listingId', auth, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server' });
    }

    const listing = await Listing.findByPk(req.params.listingId);
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (req.user.id !== listing.customerId && req.user.id !== listing.winnerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const prompt = req.body.prompt;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const context = `Listing title: ${listing.title}\nCargo type: ${listing.cargoType}\nWeight: ${listing.weight}kg\nPickup: ${listing.pickupAddress}\nDropoff: ${listing.dropoffAddress}\nRoute eligible for add-ons: ${listing.isAddOnEligible ? 'yes' : 'no'}`;
    const requestBody = {
      model: 'groq:latest',
      prompt: `You are Renta AI, a logistics assistant. Use the following listing context to answer the user. Context:\n${context}\n\nUser: ${prompt}`
    };

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Groq API error: ${response.status} ${errText}` });
    }

    const result = await response.json();
    const reply = result?.output?.[0]?.content?.[0]?.text || result?.choices?.[0]?.message?.content?.[0]?.text || result?.completion || result?.output?.[0]?.text || JSON.stringify(result);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
