const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { addEvent } = require('../realtime/events');
const {
  getExarotonServerId,
  getExarotonToken,
  listExarotonServers,
  rememberExarotonConnection,
  sendMinecraftCommand,
} = require('../services/minecraftService');
const { ApiResponse } = require('../utils/ApiResponse');
const { createHttpError, normalizeError } = require('../utils/errors');
const { getMinecraftCommands } = require('../utils/minecraft');

const router = express.Router();

router.get('/minecraft/exaroton/servers', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    const token = getExarotonToken(req);
    rememberExarotonConnection({ token });
    const servers = await listExarotonServers(token);
    res.status(200).json(ApiResponse.success({
      message: 'Exaroton servers retrieved successfully',
      data: { servers },
      meta: {
        page: 1,
        limit: servers.length,
        total: servers.length,
        totalPages: 1,
      },
    }));
  } catch (error) {
    throw createHttpError(400, error.message);
  }
}));

router.post('/minecraft/commands', requireAuth, requireVerifiedEmail, asyncHandler(async (req, res) => {
  try {
    const provider = String(req.body.provider || 'exaroton').trim().toLowerCase();
    const command = String(req.body.command || '');

    if (provider !== 'exaroton') {
      throw createHttpError(400, 'Minecraft command provider is invalid.');
    }

    const exarotonToken = getExarotonToken(req);
    const serverId = getExarotonServerId(req);
    rememberExarotonConnection({ token: exarotonToken, serverId });

    const results = await sendMinecraftCommand(command, {
      provider,
      exarotonToken,
      serverId,
    });
    addEvent('command_sent', {
      source: 'minecraft',
      provider,
      detail: getMinecraftCommands(command).join(' | '),
      results,
    });

    res.status(200).json(ApiResponse.success({
      message: 'Minecraft command sent successfully',
      data: {
        provider,
        serverId,
        results,
      },
    }));
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'minecraft', detail });
    if (error.statusCode) {
      throw error;
    }
    throw createHttpError(400, detail);
  }
}));

module.exports = router;
