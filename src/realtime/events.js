const { MAX_EVENTS } = require('../config');
const { state } = require('../state');
const { normalizeError } = require('../utils/errors');

let wss = null;
let ruleEventHandler = null;

function setWebSocketServer(server) {
  wss = server;
}

function setRuleEventHandler(handler) {
  ruleEventHandler = handler;
}

function broadcast(message) {
  if (!wss) {
    return;
  }

  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
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
  if (ruleEventHandler && ['gift', 'like', 'follow', 'member', 'share', 'chat'].includes(type)) {
    ruleEventHandler(event).catch((error) => {
      addEvent('error', { source: 'minecraft', detail: normalizeError(error) });
    });
  }
  return event;
}

module.exports = {
  addEvent,
  broadcast,
  setRuleEventHandler,
  setWebSocketServer,
};
