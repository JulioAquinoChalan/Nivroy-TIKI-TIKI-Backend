const express = require('express');
const { getOverlayRules } = require('../services/rulesService');
const { renderAnnouncementsOverlay } = require('../views/announcementsOverlay');
const { renderRulesOverlay } = require('../views/rulesOverlay');
const { normalizeError } = require('../utils/errors');
const { disableCache } = require('../utils/http');

const router = express.Router();

router.get(['/overlay', '/overlay/rules'], async (req, res) => {
  try {
    disableCache(res);
    const uid = req.query.uid;
    const rules = await getOverlayRules(uid);
    res.type('html').send(renderRulesOverlay(rules, uid));
  } catch (error) {
    res.status(400).type('html').send('Could not load overlay rules.');
  }
});

router.get('/overlay/announcements', async (req, res) => {
  try {
    disableCache(res);
    const uid = req.query.uid;
    const rules = await getOverlayRules(uid);
    res.type('html').send(renderAnnouncementsOverlay(rules, uid));
  } catch (error) {
    res.status(400).type('html').send('Could not load announcements overlay.');
  }
});

router.get('/overlay/rules.json', async (req, res) => {
  try {
    disableCache(res);
    res.json(await getOverlayRules(req.query.uid));
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

module.exports = router;
