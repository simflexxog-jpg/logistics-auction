const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { Listing } = require('../models');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

function extractReply(result) {
  if (typeof result?.choices?.[0]?.message?.content === 'string') {
    return result.choices[0].message.content;
  }

  if (Array.isArray(result?.choices?.[0]?.message?.content)) {
    return result.choices[0].message.content.map((item) => item?.text || item?.content || '').join('').trim();
  }

  if (Array.isArray(result?.output)) {
    return result.output.map((item) => item?.content?.[0]?.text || item?.text || '').join('').trim();
  }

  if (typeof result?.completion === 'string') return result.completion;
  if (typeof result?.reply === 'string') return result.reply;
  return '';
}

function buildLocalReply(listing, prompt) {
  const weight = Number(listing?.weight || 0);
  const sizeNote = weight < 100 ? 'This looks like a strong add-on candidate because it is under 100kg.' : 'This shipment is heavier, so it may be better handled as a dedicated main shipment.';
  const routeNote = listing?.pickupAddress && listing?.dropoffAddress
    ? `Your route runs from ${listing.pickupAddress} to ${listing.dropoffAddress}.`
    : 'Your route details are available in the listing.';

  return `I reviewed the shipment details for you. ${sizeNote} ${routeNote} For best results, keep the pickup window, handling instructions, and delivery requirements very clear in the listing. If you want, I can also help you draft a short customer-facing update or a competitive bid strategy.`;
}

router.post('/assistant/:listingId', auth, async (req, res) => {
  try {
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

    const fallbackReply = buildLocalReply(listing, prompt);
    if (!GROQ_API_KEY) {
      return res.json({ reply: fallbackReply });
    }

    const requestBody = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are Renta AI, a logistics assistant. Use the listing context to provide concise, practical guidance for the shipment.'
        },
        {
          role: 'user',
          content: `Use the following listing context to answer the user. Context:\n${context}\n\nUser: ${prompt}`
        }
      ],
      temperature: 0.7
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
      return res.json({ reply: fallbackReply });
    }

    const result = await response.json();
    const reply = extractReply(result) || fallbackReply;
    res.json({ reply });
  } catch (err) {
    res.json({ reply: 'The assistant is unavailable right now, but I can still help with the shipment details. Please review the listing route, weight, and pickup window carefully.' });
  }
});

module.exports = {
  router,
  buildLocalReply,
  extractReply
};
