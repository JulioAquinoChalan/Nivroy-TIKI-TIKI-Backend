const express = require('express');
const { state } = require('../state');
const { ApiResponse } = require('../utils/ApiResponse');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json(ApiResponse.success({
    message: 'Service health retrieved successfully',
    data: {
      service: 'nivroy-tiki-tiki-backend',
      currentUserId: state.currentUserId,
      currentUserEmail: state.currentUserEmail,
      tiktokConnected: state.tiktokConnected,
      currentTikTokUser: state.currentTikTokUser,
      minecraftProvider: state.minecraftConnection.provider,
      minecraftServerId: state.minecraftConnection.exarotonServerId,
    },
  }));
});

router.get('/events', (req, res) => {
  res.status(200).json(ApiResponse.success({
    message: 'Events retrieved successfully',
    data: state.events,
    meta: {
      page: 1,
      limit: state.events.length,
      total: state.events.length,
      totalPages: 1,
    },
  }));
});

module.exports = router;
