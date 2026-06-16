const { EXAROTON_API_BASE_URL, EXAROTON_API_TOKEN, EXAROTON_SERVER_ID } = require('../config');
const { state } = require('../state');
const { getRequestHeader } = require('../utils/http');
const { getMinecraftCommands } = require('../utils/minecraft');

function getExarotonToken(req = null, explicitToken = '') {
  return String(
    explicitToken
      || req?.body?.exarotonToken
      || req?.body?.token
      || getRequestHeader(req, 'x-exaroton-token')
      || state.minecraftConnection.exarotonToken
      || EXAROTON_API_TOKEN
      || '',
  ).trim();
}

function getExarotonServerId(req = null, explicitServerId = '') {
  return String(
    explicitServerId
      || req?.body?.serverId
      || getRequestHeader(req, 'x-exaroton-server-id')
      || state.minecraftConnection.exarotonServerId
      || EXAROTON_SERVER_ID
      || '',
  ).trim();
}

function rememberExarotonConnection({ token = '', serverId = '' }) {
  const nextToken = String(token || '').trim();
  const nextServerId = String(serverId || '').trim();

  if (nextToken) {
    state.minecraftConnection.exarotonToken = nextToken;
  }
  if (nextServerId) {
    state.minecraftConnection.exarotonServerId = nextServerId;
  }
  if (state.minecraftConnection.exarotonToken && state.minecraftConnection.exarotonServerId) {
    state.minecraftConnection.provider = 'exaroton';
  }
}

async function callExarotonApi(pathname, { method = 'GET', token, body } = {}) {
  const apiToken = String(token || '').trim();
  if (!apiToken) {
    throw new Error('Exaroton API token is required.');
  }

  const response = await fetch(`${EXAROTON_API_BASE_URL}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Exaroton API returned ${response.status}`);
  }
  return data.data;
}

function normalizeExarotonServer(server) {
  return {
    id: server.id,
    name: server.name,
    address: server.address,
    status: server.status,
    host: server.host,
    port: server.port,
    players: server.players,
    software: server.software,
    shared: server.shared === true,
  };
}

async function listExarotonServers(token) {
  const servers = await callExarotonApi('/servers/', { token });
  return Array.isArray(servers) ? servers.map(normalizeExarotonServer) : [];
}

async function sendExarotonCommands({ token, serverId, command }) {
  const targetServerId = String(serverId || '').trim();
  if (!targetServerId) {
    throw new Error('Exaroton server ID is required.');
  }

  const commands = getMinecraftCommands(command);
  if (commands.length === 0) {
    throw new Error('Minecraft command is required.');
  }

  const results = [];
  for (const line of commands) {
    const result = await callExarotonApi(
      `/servers/${encodeURIComponent(targetServerId)}/command/`,
      {
        method: 'POST',
        token,
        body: { command: line },
      },
    );
    results.push({ command: line, result });
  }

  return results;
}

async function sendMinecraftCommand(command, options = {}) {
  const provider = String(options.provider || state.minecraftConnection.provider || '').trim().toLowerCase();
  if (provider !== 'exaroton') {
    throw new Error('No Minecraft command provider is configured.');
  }

  const token = options.exarotonToken || state.minecraftConnection.exarotonToken || EXAROTON_API_TOKEN;
  const serverId = options.serverId || state.minecraftConnection.exarotonServerId || EXAROTON_SERVER_ID;
  return sendExarotonCommands({ token, serverId, command });
}

module.exports = {
  getExarotonServerId,
  getExarotonToken,
  listExarotonServers,
  rememberExarotonConnection,
  sendMinecraftCommand,
};
