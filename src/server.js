require('dotenv').config();

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { WebSocketServer } = require('ws');
const tiktokLive = require('tiktok-live-connector');
const { Rcon } = require('rcon-client');

const PORT = Number(process.env.PORT || 3000);
const MAX_EVENTS = 100;
const TikTokConnection = tiktokLive.WebcastPushConnection || tiktokLive.TikTokLiveConnection;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
const FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL = process.env.FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL || '';
const LEGACY_RULES_FILE = path.join(__dirname, '..', 'data', 'rules.json');

const defaultRules = [
  { id: 'rose', eventType: 'gift', trigger: 'Rose', command: 'execute at @a run summon minecraft:creeper ~ ~ ~', target: 'Creeper', enabled: true },
  { id: 'heart-me', eventType: 'gift', trigger: 'Heart Me', command: 'execute at @a run summon minecraft:zombie ~ ~ ~', target: 'Zombie', enabled: true },
  { id: 'gg', eventType: 'gift', trigger: 'GG', command: 'execute at @a run summon minecraft:skeleton ~ ~ ~', target: 'Skeleton', enabled: true },
  { id: 'like', eventType: 'like', trigger: 'Like', command: 'execute at @a run summon minecraft:zombie ~ ~ ~', target: 'Zombie', enabled: true },
];

function getSeedRules() {
  try {
    if (!fs.existsSync(LEGACY_RULES_FILE)) {
      return defaultRules;
    }

    const parsed = JSON.parse(fs.readFileSync(LEGACY_RULES_FILE, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultRules;
  } catch (error) {
    console.error(`Could not load legacy rules seed: ${error.message}`);
    return defaultRules;
  }
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountJson) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
    });
    return;
  }

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    initializeApp({
      credential: cert(require(resolvedPath)),
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
  });
}

initializeFirebaseAdmin();

const auth = getAuth();
const firestore = getFirestore();

function getUserRulesCollection(uid) {
  return firestore.collection('users').doc(uid).collection('rules');
}

async function loadUserRules(uid) {
  const snapshot = await getUserRulesCollection(uid).get();
  return snapshot.docs.map((doc) => normalizeRule({ id: doc.id, ...doc.data() }));
}

async function ensureUserRules(uid) {
  const rules = await loadUserRules(uid);
  if (rules.length > 0) {
    return rules;
  }

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  for (const rule of getSeedRules().map((item) => normalizeRule(item))) {
    batch.set(getUserRulesCollection(uid).doc(rule.id), {
      ...rule,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  return loadUserRules(uid);
}

async function setActiveUser(user) {
  if (!user?.uid) {
    state.currentUserId = '';
    state.currentUserEmail = '';
    state.rules = [];
    return;
  }

  if (state.currentUserId === user.uid && state.rules.length > 0) {
    return;
  }

  state.currentUserId = user.uid;
  state.currentUserEmail = user.email || '';
  state.rules = await ensureUserRules(user.uid);
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Authorization token is required.' });
      return;
    }

    req.user = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: 'Invalid or expired authorization token.' });
  }
}

async function requireVerifiedEmail(req, res, next) {
  if (req.user?.email_verified !== true) {
    res.status(403).json({ ok: false, error: 'Email verification is required.' });
    return;
  }
  await setActiveUser(req.user);
  next();
}

function requireFirebaseWebApiKey() {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error('FIREBASE_WEB_API_KEY is required.');
  }
}

async function callFirebaseAuth(pathname, body) {
  requireFirebaseWebApiKey();
  const response = await fetch(`${FIREBASE_AUTH_BASE_URL}/${pathname}?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Firebase Auth returned ${response.status}`;
    console.error(`Firebase Auth ${pathname} failed: ${message}`);
    const error = new Error(message.replaceAll('_', ' ').toLowerCase());
    error.firebaseCode = message;
    throw error;
  }
  return data;
}

async function sendEmailVerification(idToken) {
  const request = {
    requestType: 'VERIFY_EMAIL',
    idToken,
  };

  if (FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL) {
    request.continueUrl = FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL;
  }

  await callFirebaseAuth('accounts:sendOobCode', request);
}

async function refreshFirebaseToken(refreshToken) {
  requireFirebaseWebApiKey();
  const response = await fetch(`${FIREBASE_TOKEN_URL}?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Firebase token refresh returned ${response.status}`;
    throw new Error(message.replaceAll('_', ' ').toLowerCase());
  }
  return data;
}

function authPayload(data) {
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: Number(data.expiresIn || 3600),
    uid: data.localId,
    email: data.email || '',
    emailVerified: data.emailVerified === true,
  };
}

function getActiveRules() {
  return state.rules.filter((rule) => rule.enabled !== false);
}

function disableCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderRulesOverlay() {
  const rulesJson = JSON.stringify(getActiveRules());

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nivroy TIKI-TIKI Overlay</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: rgba(10, 12, 14, 0.70);
      --panel: rgba(22, 26, 29, 0.86);
      --line: rgba(139, 232, 211, 0.32);
      --text: #eef7f5;
      --muted: #b8c7c3;
      --accent: #8be8d3;
      --accent-2: #ffe082;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      background: transparent;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .overlay {
      width: min(460px, calc(100vw - 32px));
      margin: 6px;
      padding: 10px;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.40);
      backdrop-filter: blur(10px);
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 7px;
    }
    h1 {
      margin: 0;
      font-size: 21px;
      line-height: 1;
      letter-spacing: 0;
    }
    .tagline {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }
    .rules {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5px;
    }
    .rule {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 5px;
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(139, 232, 211, 0.14);
      color: var(--accent);
      font-size: 10px;
      font-weight: 900;
    }
    .event {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 2px;
      padding: 2px 6px;
      border: 1px solid rgba(139, 232, 211, 0.38);
      border-radius: 999px;
      color: var(--accent);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .instruction {
      font-size: 12px;
      line-height: 1.1;
      font-weight: 800;
    }
    .target {
      margin-top: 2px;
      color: var(--accent-2);
      font-size: 10px;
      font-weight: 700;
    }
    .empty {
      padding: 16px;
      color: var(--muted);
      background: var(--panel);
      border-radius: 14px;
    }
    @media (max-width: 620px) {
      .overlay { width: calc(100vw - 12px); margin: 6px; padding: 8px; }
      .rules { grid-template-columns: 1fr; }
      h1 { font-size: 18px; }
      .tagline { font-size: 10px; }
    }
  </style>
</head>
<body>
  <main class="overlay">
    <div class="header">
      <div class="tagline">Activa eventos en Minecraft</div>
    </div>
    <section id="rules" class="rules"></section>
  </main>
  <script>
    const initialRules = ${rulesJson};
    const pageSize = 6;
    let activeRules = initialRules;
    let pageIndex = 0;
    const labels = {
      gift: 'Regalo',
      like: 'Like',
      follow: 'Follow',
      member: 'Entrada',
      share: 'Share',
      chat: 'Chat'
    };
    const icons = {
      gift: 'GIFT',
      like: 'LIKE',
      follow: 'FOL',
      member: 'JOIN',
      share: 'SHR',
      chat: 'CHAT'
    };

    function instruction(rule) {
      const trigger = escapeHtml(rule.trigger || '');
      if (rule.eventType === 'chat') return 'Escribe <strong>' + trigger + '</strong>';
      if (rule.eventType === 'like') return 'Toca like para activar';
      if (rule.eventType === 'follow') return 'Sigue el live';
      if (rule.eventType === 'member') return 'Entra al live';
      if (rule.eventType === 'share') return 'Comparte el live';
      return 'Envia <strong>' + trigger + '</strong>';
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function visibleRules() {
      if (activeRules.length <= pageSize) {
        pageIndex = 0;
        return activeRules;
      }

      const pageCount = Math.ceil(activeRules.length / pageSize);
      if (pageIndex >= pageCount) {
        pageIndex = 0;
      }

      const start = pageIndex * pageSize;
      return activeRules.slice(start, start + pageSize);
    }

    function setRules(rules) {
      activeRules = rules.filter((rule) => rule.enabled !== false);
      render(visibleRules());
    }

    function rotateRules() {
      if (activeRules.length <= pageSize) {
        return;
      }

      pageIndex = (pageIndex + 1) % Math.ceil(activeRules.length / pageSize);
      render(visibleRules());
    }

    function render(rules) {
      const root = document.getElementById('rules');
      if (!rules.length) {
        root.className = '';
        root.innerHTML = '<div class="empty">No hay comandos activos.</div>';
        return;
      }
      root.className = 'rules';
      root.innerHTML = rules.map((rule) => {
        const type = rule.eventType || 'gift';
        return '<article class="rule">' +
          '<div>' +
            '<div class="event">' + escapeHtml(labels[type] || type) + '</div>' +
            '<div class="instruction">' + instruction(rule) + '</div>' +
            '<div class="target">→ ' + escapeHtml(rule.target || 'Minecraft') + '</div>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    async function loadRules() {
      try {
        const response = await fetch('/overlay/rules.json?t=' + Date.now(), { cache: 'no-store' });
        const rules = await response.json();
        setRules(rules);
      } catch (error) {
        setRules(initialRules);
      }
    }

    function connectOverlaySocket() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(protocol + '//' + window.location.host);

        socket.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.source === 'rules' || payload.type === 'rule_saved' || payload.type === 'rule_updated') {
              loadRules();
            }
          } catch (error) {
            loadRules();
          }
        });

        socket.addEventListener('close', () => {
          setTimeout(connectOverlaySocket, 2500);
        });
      } catch (error) {
        setTimeout(connectOverlaySocket, 5000);
      }
    }

    setRules(initialRules);
    connectOverlaySocket();
    setInterval(loadRules, 2000);
    setInterval(rotateRules, 3000);
    loadRules();
  </script>
</body>
</html>`;
}

const state = {
  tiktokConnected: false,
  minecraftConnected: false,
  currentUserId: '',
  currentUserEmail: '',
  currentTikTokUser: process.env.TIKTOK_USERNAME || '',
  minecraftHost: process.env.MINECRAFT_HOST || '127.0.0.1',
  minecraftPort: Number(process.env.MINECRAFT_PORT || 25575),
  rules: [],
  events: [],
};

let tiktokConnection = null;
let rconConnection = null;
let rconConfig = null;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

function sanitizeMinecraftName(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 16) || 'unknown';
}

function normalizeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeMinecraftCommand(command) {
  return String(command || '')
    .replace(/Count\s*:\s*1b/g, 'count:1')
    .replace(/Count\s*:\s*1/g, 'count:1');
}

function getMinecraftCommands(command) {
  return normalizeMinecraftCommand(command)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getTikTokUniqueId(data) {
  return data?.uniqueId || data?.user?.uniqueId || data?.user?.displayId || data?.userId || 'unknown';
}

function getTikTokGiftName(data) {
  return data?.giftName || data?.gift?.name || data?.extendedGiftInfo?.name || data?.giftId || 'Unknown gift';
}

function getTikTokComment(data) {
  return String(data?.comment || data?.content || '').trim();
}

function createRuleId(trigger) {
  return `${Date.now()}-${String(trigger).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function normalizeRule(input) {
  const eventType = String(input.eventType || 'gift').trim().toLowerCase();
  const trigger = String(input.trigger || '').trim();
  const command = getMinecraftCommands(input.command).join('\n');
  const target = String(input.target || trigger).trim();

  if (!['gift', 'like', 'follow', 'member', 'share', 'chat'].includes(eventType)) {
    throw new Error('Rule event type is invalid.');
  }

  if (!trigger) {
    throw new Error('Rule trigger is required.');
  }

  if (!command) {
    throw new Error('Minecraft command is required.');
  }

  return {
    id: input.id || createRuleId(trigger),
    eventType,
    trigger,
    command,
    target: target || trigger,
    enabled: input.enabled !== false,
  };
}

async function saveRule(uid, rule) {
  const existingIndex = state.rules.findIndex(
    (item) => (item.eventType || 'gift') === rule.eventType
      && item.trigger.toLowerCase() === rule.trigger.toLowerCase(),
  );

  const now = FieldValue.serverTimestamp();
  if (existingIndex >= 0) {
    const nextRule = { ...state.rules[existingIndex], ...rule };
    state.rules[existingIndex] = nextRule;
    await getUserRulesCollection(uid).doc(nextRule.id).set({
      ...nextRule,
      updatedAt: now,
    }, { merge: true });
  } else {
    state.rules.push(rule);
    await getUserRulesCollection(uid).doc(rule.id).set({
      ...rule,
      createdAt: now,
      updatedAt: now,
    });
  }

  addEvent('rule_saved', {
    source: 'rules',
    detail: `${rule.trigger} -> ${rule.command}`,
  });

  return existingIndex >= 0 ? state.rules[existingIndex] : rule;
}

function findRule(eventType, trigger) {
  return state.rules.find((rule) => (
    rule.enabled !== false
    &&
    (rule.eventType || 'gift') === eventType
    && rule.trigger.toLowerCase() === String(trigger).toLowerCase()
  ));
}

function findLikeRule() {
  return findRule('like', 'Like')
    || state.rules.find((rule) => rule.enabled !== false && (rule.eventType || 'gift') === 'like');
}

async function executeRule(rule, username) {
  try {
    await executeMinecraftCommand(rule.command, username);
  } catch (error) {
    addEvent('error', {
      source: 'minecraft',
      user: username,
      detail: normalizeError(error),
    });
  }
}

function addEvent(type, payload = {}) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  state.events.unshift(event);
  state.events = state.events.slice(0, MAX_EVENTS);
  broadcast(event);
  return event;
}

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

function getMinecraftConfig(options = {}) {
  const host = String(options.host || process.env.MINECRAFT_HOST || '127.0.0.1').trim();
  const port = Number(options.port || process.env.MINECRAFT_PORT || 25575);

  if (!host) {
    throw new Error('Minecraft host is required.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Minecraft port must be a valid TCP port.');
  }

  return {
    host,
    port,
    password: process.env.MINECRAFT_RCON_PASSWORD || '',
  };
}

async function closeRconConnection() {
  if (!rconConnection) {
    return;
  }

  const connection = rconConnection;
  rconConnection = null;
  rconConfig = null;
  state.minecraftConnected = false;

  try {
    await connection.end();
  } catch (error) {
    addEvent('error', { source: 'minecraft', detail: normalizeError(error) });
  }
}

async function getRconConnection(options = {}) {
  const nextConfig = getMinecraftConfig(options);
  const configKey = `${nextConfig.host}:${nextConfig.port}`;

  if (rconConnection && rconConfig === configKey) {
    return rconConnection;
  }

  await closeRconConnection();

  rconConnection = await Rcon.connect(nextConfig);
  rconConfig = configKey;

  state.minecraftConnected = true;
  state.minecraftHost = nextConfig.host;
  state.minecraftPort = nextConfig.port;
  addEvent('connected', {
    source: 'minecraft',
    detail: `Minecraft RCON connected to ${configKey}`,
  });

  rconConnection.on('end', () => {
    rconConnection = null;
    rconConfig = null;
    state.minecraftConnected = false;
    addEvent('disconnected', { source: 'minecraft', detail: 'Minecraft RCON disconnected' });
  });

  rconConnection.on('error', (error) => {
    state.minecraftConnected = false;
    addEvent('error', { source: 'minecraft', detail: normalizeError(error) });
  });

  return rconConnection;
}

async function executeMinecraftCommand(command, username, minecraftOptions = {}) {
  const safeUser = sanitizeMinecraftName(username);
  const commandsToRun = getMinecraftCommands(command).map((item) => (
    item.replaceAll('{user}', safeUser).trim()
  ));

  if (commandsToRun.length === 0) {
    throw new Error('Minecraft command is required.');
  }

  const rcon = await getRconConnection(minecraftOptions);
  const responses = [];
  for (const item of commandsToRun) {
    responses.push(await rcon.send(item));
  }
  const commandToRun = commandsToRun.join('\n');

  addEvent('minecraft_command_executed', {
    user: safeUser,
    detail: commandToRun,
    response: responses.join('\n'),
  });

  return { command: commandToRun, response: responses };
}

function attachTikTokHandlers(connection) {
  connection.on('chat', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    const comment = getTikTokComment(data);
    addEvent('chat', {
      user: safeUser,
      detail: comment,
      raw: data,
    });

    const rule = findRule('chat', comment);
    if (rule) {
      executeRule(rule, safeUser);
    } else if (comment) {
      addEvent('rule_missed', {
        source: 'rules',
        user: safeUser,
        detail: `No rule for chat: ${comment}`,
      });
    }
  });

  connection.on('like', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('like', {
      user: safeUser,
      detail: `${data.likeCount || 1} likes`,
      raw: data,
    });

    const rule = findLikeRule();
    if (rule) {
      executeRule(rule, safeUser);
    }
  });

  connection.on('gift', async (data) => {
    const giftName = getTikTokGiftName(data);
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));

    addEvent('gift', {
      user: safeUser,
      detail: giftName,
      raw: data,
    });

    const rule = findRule('gift', giftName);
    if (!rule) {
      addEvent('rule_missed', {
        source: 'rules',
        user: safeUser,
        detail: `No rule for gift: ${giftName}`,
      });
      return;
    }

    await executeRule(rule, safeUser);
  });

  connection.on('follow', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('follow', {
      user: safeUser,
      detail: 'New follower',
      raw: data,
    });

    const rule = findRule('follow', 'Follow');
    if (rule) {
      executeRule(rule, safeUser);
    }
  });

  connection.on('member', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('member', {
      user: safeUser,
      detail: 'Joined the live',
      raw: data,
    });

    const rule = findRule('member', 'Member');
    if (rule) {
      executeRule(rule, safeUser);
    }
  });

  connection.on('share', (data) => {
    const safeUser = sanitizeMinecraftName(getTikTokUniqueId(data));
    addEvent('share', {
      user: safeUser,
      detail: 'Shared the live',
      raw: data,
    });

    const rule = findRule('share', 'Share');
    if (rule) {
      executeRule(rule, safeUser);
    }
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
  const targetUser = String(username || process.env.TIKTOK_USERNAME || '').replace(/^@/, '').trim();

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

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'nivroy-tiki-tiki-backend',
    currentUserId: state.currentUserId,
    currentUserEmail: state.currentUserEmail,
    tiktokConnected: state.tiktokConnected,
    minecraftConnected: state.minecraftConnected,
    minecraftHost: state.minecraftHost,
    minecraftPort: state.minecraftPort,
    currentTikTokUser: state.currentTikTokUser,
  });
});

app.get('/events', (req, res) => {
  res.json(state.events);
});

app.get(['/overlay', '/overlay/rules'], (req, res) => {
  disableCache(res);
  res.type('html').send(renderRulesOverlay());
});

app.get('/overlay/rules.json', (req, res) => {
  disableCache(res);
  res.json(state.rules);
});

app.post('/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    let data;
    try {
      data = await callFirebaseAuth('accounts:signUp', {
        email,
        password,
        returnSecureToken: true,
      });
    } catch (error) {
      if (error.firebaseCode !== 'EMAIL_EXISTS') {
        throw error;
      }

      data = await callFirebaseAuth('accounts:signInWithPassword', {
        email,
        password,
        returnSecureToken: true,
      });
    }

    if (data.emailVerified !== true) {
      await sendEmailVerification(data.idToken);
    }
    res.json({ ok: true, ...authPayload(data) });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const data = await callFirebaseAuth('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    if (data.emailVerified === true) {
      await setActiveUser({ uid: data.localId, email: data.email });
    }
    res.json({ ok: true, ...authPayload(data) });
  } catch (error) {
    res.status(401).json({ ok: false, error: normalizeError(error) });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || '');
    const data = await refreshFirebaseToken(refreshToken);
    const user = await auth.getUser(data.user_id);
    if (user.emailVerified === true) {
      await setActiveUser({ uid: data.user_id, email: user.email });
    }
    res.json({
      ok: true,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in || 3600),
      uid: data.user_id,
      email: user.email || '',
      emailVerified: user.emailVerified === true,
    });
  } catch (error) {
    res.status(401).json({ ok: false, error: normalizeError(error) });
  }
});

app.post('/auth/send-email-verification', requireAuth, async (req, res) => {
  try {
    await sendEmailVerification(getBearerToken(req));
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await auth.getUser(req.user.uid);
    res.json({
      ok: true,
      uid: user.uid,
      email: user.email || '',
      emailVerified: user.emailVerified === true,
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

app.get('/rules', requireAuth, requireVerifiedEmail, (req, res) => {
  disableCache(res);
  res.json(state.rules);
});

app.post('/rules', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const rule = normalizeRule(req.body);
    const savedRule = await saveRule(req.user.uid, rule);
    res.json({ ok: true, rule: savedRule });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

app.put('/rules/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const index = state.rules.findIndex((rule) => rule.id === req.params.id);
    if (index < 0) {
      res.status(404).json({ ok: false, error: 'Rule not found.' });
      return;
    }

    const rule = normalizeRule({ ...req.body, id: req.params.id });
    state.rules[index] = rule;
    await getUserRulesCollection(req.user.uid).doc(rule.id).set({
      ...rule,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    addEvent('rule_saved', {
      source: 'rules',
      detail: `${rule.trigger} -> ${rule.command}`,
    });

    res.json({ ok: true, rule });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

app.patch('/rules/:id/enabled', requireAuth, requireVerifiedEmail, async (req, res) => {
  const rule = state.rules.find((item) => item.id === req.params.id);
  if (!rule) {
    res.status(404).json({ ok: false, error: 'Rule not found.' });
    return;
  }

  rule.enabled = req.body.enabled !== false;
  await getUserRulesCollection(req.user.uid).doc(rule.id).set({
    enabled: rule.enabled,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  addEvent('rule_updated', {
    source: 'rules',
    detail: `${rule.trigger} ${rule.enabled ? 'enabled' : 'disabled'}`,
  });

  res.json({ ok: true, rule });
});

app.delete('/rules/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
  const before = state.rules.length;
  state.rules = state.rules.filter((rule) => rule.id !== req.params.id);
  await getUserRulesCollection(req.user.uid).doc(req.params.id).delete();
  addEvent('rule_updated', {
    source: 'rules',
    detail: `Rule ${req.params.id} deleted`,
  });
  res.json({ ok: true, deleted: before !== state.rules.length });
});

app.post('/minecraft/command', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const result = await executeMinecraftCommand(req.body.command, req.body.username, {
      host: req.body.minecraftHost,
      port: req.body.minecraftPort,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'minecraft', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

app.post('/minecraft/connect', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const connection = await getRconConnection({
      host: req.body.minecraftHost,
      port: req.body.minecraftPort,
    });
    res.json({
      ok: true,
      connected: Boolean(connection),
      minecraftHost: state.minecraftHost,
      minecraftPort: state.minecraftPort,
    });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'minecraft', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

app.post('/tiktok/connect', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const result = await connectTikTok(req.body.username);
    res.json({ ok: true, ...result });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

app.post('/tiktok/disconnect', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    await disconnectTikTok();
    res.json({ ok: true });
  } catch (error) {
    const detail = normalizeError(error);
    addEvent('error', { source: 'tiktok', detail });
    res.status(400).json({ ok: false, error: detail });
  }
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({
    type: 'connected',
    source: 'websocket',
    detail: 'Frontend connected to backend WebSocket',
    timestamp: new Date().toISOString(),
  }));
});

server.on('error', (error) => {
  console.error(`HTTP server error: ${normalizeError(error)}`);
  process.exitCode = 1;
});

wss.on('error', (error) => {
  console.error(`WebSocket server error: ${normalizeError(error)}`);
});

server.listen(PORT, () => {
  console.log(`Nivroy TIKI-TIKI backend running on http://localhost:${PORT}`);
});
