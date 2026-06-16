const http = require('http');
const { PORT } = require('./config');
const { createApp } = require('./app');
const { createWebSocketServer } = require('./realtime/websocket');
const { setRuleEventHandler } = require('./realtime/events');
const { runRulesForEvent } = require('./services/ruleRunner');
const { normalizeError } = require('./utils/errors');

setRuleEventHandler(runRulesForEvent);

const app = createApp();
const server = http.createServer(app);

createWebSocketServer(server);

server.on('error', (error) => {
  console.error(`HTTP server error: ${normalizeError(error)}`);
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.log(`Nivroy TIKI-TIKI backend running on http://localhost:${PORT}`);
});
