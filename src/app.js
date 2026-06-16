const cors = require('cors');
const express = require('express');
const { getCorsOptions } = require('./config/cors');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const minecraftRoutes = require('./routes/minecraftRoutes');
const overlayRoutes = require('./routes/overlayRoutes');
const rulesRoutes = require('./routes/rulesRoutes');
const tiktokRoutes = require('./routes/tiktokRoutes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors(getCorsOptions()));
  app.use(express.json());

  app.use(healthRoutes);
  app.use(overlayRoutes);
  app.use(authRoutes);
  app.use(rulesRoutes);
  app.use(minecraftRoutes);
  app.use(tiktokRoutes);

  return app;
}

module.exports = {
  createApp,
};
