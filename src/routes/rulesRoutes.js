const express = require('express');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const {
  normalizeRule,
  removeRule,
  replaceRule,
  saveRule,
  setRuleEnabled,
} = require('../services/rulesService');
const { state } = require('../state');
const { normalizeError } = require('../utils/errors');
const { disableCache } = require('../utils/http');

const router = express.Router();

router.get('/rules', requireAuth, requireVerifiedEmail, (req, res) => {
  disableCache(res);
  res.json(state.rules);
});

router.post('/rules', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const rule = normalizeRule(req.body);
    const savedRule = await saveRule(req.user.uid, rule);
    res.json({ ok: true, rule: savedRule });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

router.put('/rules/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const rule = await replaceRule(req.user.uid, req.params.id, req.body);
    if (!rule) {
      res.status(404).json({ ok: false, error: 'Rule not found.' });
      return;
    }

    res.json({ ok: true, rule });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

router.patch('/rules/:id/enabled', requireAuth, requireVerifiedEmail, async (req, res) => {
  const rule = await setRuleEnabled(req.user.uid, req.params.id, req.body.enabled);
  if (!rule) {
    res.status(404).json({ ok: false, error: 'Rule not found.' });
    return;
  }

  res.json({ ok: true, rule });
});

router.delete('/rules/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
  const deleted = await removeRule(req.user.uid, req.params.id);
  res.json({ ok: true, deleted });
});

module.exports = router;
