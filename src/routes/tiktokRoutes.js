const express = require('express');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { addEvent } = require('../realtime/events');
const { connectTikTok, disconnectTikTok } = require('../services/tiktokService');
const { normalizeError } = require('../utils/errors');

const router = express.Router();

router.post('/tiktok/connect', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const result = await connectTikTok(req.body.username);
    res.json({ ok: true, ...result });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

router.post('/tiktok/disconnect', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    await disconnectTikTok();
    res.json({ ok: true });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

module.exports = router;
