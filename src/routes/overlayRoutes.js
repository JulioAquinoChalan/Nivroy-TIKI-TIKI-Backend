const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getOverlayRules } = require('../services/rulesService');
const { renderAnnouncementsOverlay } = require('../views/announcementsOverlay');
const { renderRulesOverlay } = require('../views/rulesOverlay');
const { ApiResponse } = require('../utils/ApiResponse');
const { createHttpError, normalizeError } = require('../utils/errors');
const { disableCache } = require('../utils/http');

const router = express.Router();

router.get(['/overlay', '/overlay/rules'], asyncHandler(async (req, res) => {
  try {
    disableCache(res);
    const uid = req.query.uid;
    const rules = await getOverlayRules(uid);
    res.type('html').send(renderRulesOverlay(rules, uid));
  } catch (error) {
    throw createHttpError(400, 'Could not load overlay rules.');
  }
}));

router.get('/overlay/announcements', asyncHandler(async (req, res) => {
  try {
    disableCache(res);
    const uid = req.query.uid;
    const rules = await getOverlayRules(uid);
    res.type('html').send(renderAnnouncementsOverlay(rules, uid));
  } catch (error) {
    throw createHttpError(400, 'Could not load announcements overlay.');
  }
}));

router.get('/overlay/rules.json', async (req, res) => {
  try {
    disableCache(res);
    const rules = await getOverlayRules(req.query.uid);
    res.status(200).json(ApiResponse.success({
      message: 'Overlay rules retrieved successfully',
      data: rules,
      meta: {
        page: 1,
        limit: rules.length,
        total: rules.length,
        totalPages: 1,
      },
    }));
  } catch (error) {
    res.status(400).json(ApiResponse.badRequest({
      message: 'Could not load overlay rules.',
      detail: normalizeError(error),
    }));
  }
});

module.exports = router;
