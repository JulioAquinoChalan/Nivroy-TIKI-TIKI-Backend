const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { addEvent } = require('../realtime/events');
const { connectTikTok, disconnectTikTok } = require('../services/tiktokService');
const { ApiResponse } = require('../utils/ApiResponse');
const { createHttpError, normalizeError } = require('../utils/errors');

const router = express.Router();

router.post('/tiktok/connect', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    const result = await connectTikTok(req.body.username);
    res.status(200).json(ApiResponse.success({
      message: 'TikTok Live connected successfully',
      data: result,
    }));
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    throw createHttpError(400, detail);
  }
}));

router.post('/tiktok/disconnect', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    await disconnectTikTok();
    res.status(200).json(ApiResponse.success({
      message: 'TikTok Live disconnected successfully',
      data: {},
    }));
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    throw createHttpError(400, detail);
  }
}));

module.exports = router;
