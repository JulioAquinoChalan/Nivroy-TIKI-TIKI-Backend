const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { addEvent } = require('../realtime/events');
const {
  normalizeRule,
  removeRule,
  replaceRule,
  saveRule,
  setRuleEnabled,
} = require('../services/rulesService');
const { state } = require('../state');
const { ApiResponse } = require('../utils/ApiResponse');
const { createHttpError } = require('../utils/errors');
const { disableCache } = require('../utils/http');
const { getMinecraftCommands } = require('../utils/minecraft');

const router = express.Router();

router.get('/rules', requireAuth, requireVerifiedEmail, (req, res) => {
  disableCache(res);
  res.status(200).json(ApiResponse.success({
    message: 'Rules retrieved successfully',
    data: state.rules,
    meta: {
      page: 1,
      limit: state.rules.length,
      total: state.rules.length,
      totalPages: 1,
    },
  }));
});

router.post('/rules', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    const rule = normalizeRule(req.body);
    const savedRule = await saveRule(req.user.uid, rule);
    res.status(201).json(ApiResponse.created({
      message: 'Rule saved successfully',
      data: { rule: savedRule },
    }));
  } catch (error) {
    throw createHttpError(400, error.message);
  }
}));

router.put('/rules/:id', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    const rule = await replaceRule(req.user.uid, req.params.id, req.body);
    if (!rule) {
      throw createHttpError(404, 'Rule not found.');
    }

    res.status(200).json(ApiResponse.success({
      message: 'Rule updated successfully',
      data: { rule },
    }));
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    throw createHttpError(400, error.message);
  }
}));

router.patch('/rules/:id/enabled', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  const rule = await setRuleEnabled(req.user.uid, req.params.id, req.body.enabled);
  if (!rule) {
    throw createHttpError(404, 'Rule not found.');
  }

  res.status(200).json(ApiResponse.success({
    message: 'Rule status updated successfully',
    data: { rule },
  }));
}));

router.post('/rules/:id/test-overlay', requireAuth, requireVerifiedEmail, (req, res) => {
  const rule = state.rules.find((item) => item.id === req.params.id);
  if (!rule) {
    res.status(404).json(ApiResponse.notFound({
      message: 'Rule not found.',
      detail: 'Rule not found.',
    }));
    return;
  }

  const command = String(req.body.command || rule.command || '');
  addEvent('command_sent', {
    source: 'minecraft',
    provider: 'test',
    ruleId: rule.id,
    detail: getMinecraftCommands(command).join(' | '),
    test: true,
  });
  res.status(200).json(ApiResponse.success({
    message: 'Overlay test event sent successfully',
    data: {},
  }));
});

router.delete('/rules/:id', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  const deleted = await removeRule(req.user.uid, req.params.id);
  res.status(200).json(ApiResponse.success({
    message: 'Rule deleted successfully',
    data: { deleted },
  }));
}));

module.exports = router;
