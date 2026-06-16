const { WebSocketServer } = require('ws');
const { normalizeError } = require('../utils/errors');
const { setWebSocketServer } = require('./events');

function createWebSocketServer(server) {
  const wss = new WebSocketServer({ server });
  setWebSocketServer(wss);

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({
      type: 'connected',
      source: 'websocket',
      detail: 'Frontend connected to backend WebSocket',
      timestamp: new Date().toISOString(),
    }));
  });

  wss.on('error', (error) => {
    console.error(`WebSocket server error: ${normalizeError(error)}`);
  });

  return wss;
}

module.exports = {
  createWebSocketServer,
};
