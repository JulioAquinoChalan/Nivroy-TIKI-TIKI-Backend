const express = require('express');
const { requireAuth, requireVerifiedEmail } = require('../middleware/auth');
const { addEvent } = require('../realtime/events');
const {
  getExarotonServerId,
  getExarotonToken,
  listExarotonServers,
  rememberExarotonConnection,
  sendMinecraftCommand,
} = require('../services/minecraftService');
const { normalizeError } = require('../utils/errors');
const { getMinecraftCommands } = require('../utils/minecraft');

const router = express.Router();

router.get('/minecraft/exaroton/servers', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const token = getExarotonToken(req);
    rememberExarotonConnection({ token });
    res.json({ ok: true, servers: await listExarotonServers(token) });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

router.post('/minecraft/commands', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const provider = String(req.body.provider || 'exaroton').trim().toLowerCase();
    const command = String(req.body.command || '');

    if (provider !== 'exaroton') {
      res.status(400).json({ ok: false, error: 'Minecraft command provider is invalid.' });
      return;
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

    res.json({
      ok: true,
      provider,
      serverId,
      results,
    });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'minecraft', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

module.exports = router;
