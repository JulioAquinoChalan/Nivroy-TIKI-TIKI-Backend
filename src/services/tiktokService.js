const tiktokLive = require('tiktok-live-connector');
const { TIKTOK_USERNAME } = require('../config');
const { state } = require('../state');
const { addEvent } = require('../realtime/events');
const { normalizeError } = require('../utils/errors');
const { sanitizeMinecraftName } = require('../utils/minecraft');
const { getTikTokComment, getTikTokGiftName, getTikTokUniqueId } = require('../utils/tiktok');

const TikTokConnection = tiktokLive.WebcastPushConnection || tiktokLive.TikTokLiveConnection;
let tiktokConnection = null;

function attachTikTokHandlers(connection) {
  connection.on('chat', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('chat', {
      user: safeUser,
      detail: getTikTokComment(data),
      raw: data,
    });
  });

  connection.on('like', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('like', {
      user: safeUser,
      detail: `${data.likeCount || 1} likes`,
      raw: data,
    });
  });

  connection.on('gift', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('gift', {
      user: safeUser,
      detail: getTikTokGiftName(data),
      raw: data,
    });
  });

  connection.on('follow', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('follow', {
      user: safeUser,
      detail: 'New follower',
      raw: data,
    });
  });

  connection.on('member', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('member', {
      user: safeUser,
      detail: 'Joined the live',
      raw: data,
    });
  });

  connection.on('share', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('share', {
      user: safeUser,
      detail: 'Shared the live',
      raw: data,
    });
  });

  connection.on('disconnected', () => {
    state.tiktokConnected = false;
    addEvent('disconnected', { source: 'tiktok', detail: 'TikTok Live disconnected' });
  });

  connection.on('error', (error) => {
    addEvent('error', { source: 'tiktok', detail: normalizeError(error) });
  });
}

async function connectTikTok(username) {
  const targetUser = String(username || TIKTOK_USERNAME || '').replace(/^@/, '').trim();

  if (!targetUser) {
    throw new Error('TikTok username is required.');
  }

  if (tiktokConnection) {
    await disconnectTikTok();
  }

  state.currentTikTokUser = targetUser;
  if (!TikTokConnection) {
    throw new Error('tiktok-live-connector did not expose a supported connection class.');
  }

  tiktokConnection = new TikTokConnection(targetUser, {});
  attachTikTokHandlers(tiktokConnection);

  await tiktokConnection.connect();
  state.tiktokConnected = true;

  addEvent('connected', {
    source: 'tiktok',
    user: targetUser,
    detail: `Connected to @${targetUser}`,
  });

  return { username: targetUser };
}

async function disconnectTikTok() {
  if (!tiktokConnection) {
    state.tiktokConnected = false;
    return;
  }

  const connection = tiktokConnection;
  tiktokConnection = null;
  await connection.disconnect();
  state.tiktokConnected = false;

  addEvent('disconnected', {
    source: 'tiktok',
    user: state.currentTikTokUser,
    detail: 'TikTok Live disconnected',
  });
}

module.exports = {
  connectTikTok,
  disconnectTikTok,
};
