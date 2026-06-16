const { CORS_ORIGIN } = require('./index');

function getCorsOptions() {
  if (CORS_ORIGIN === '*') {
    return { origin: true };
  }

  const allowedOrigins = CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'));
    },
  };
}

module.exports = {
  getCorsOptions,
};
