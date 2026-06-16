const express = require('express');
const { state } = require('../state');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'nivroy-tiki-tiki-backend',
    currentUserId: state.currentUserId,
    currentUserEmail: state.currentUserEmail,
    tiktokConnected: state.tiktokConnected,
    currentTikTokUser: state.currentTikTokUser,
    minecraftProvider: state.minecraftConnection.provider,
    minecraftServerId: state.minecraftConnection.exarotonServerId,
  });
});

router.get('/events', (req, res) => {
  res.json(state.events);
});

module.exports = router;
