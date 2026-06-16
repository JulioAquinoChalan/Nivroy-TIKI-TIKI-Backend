require('dotenv').config();

const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';
const FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL = process.env.FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL || '';
const EXAROTON_API_BASE_URL = process.env.EXAROTON_API_BASE_URL || 'https://api.exaroton.com/v1';
const EXAROTON_API_TOKEN = process.env.EXAROTON_API_TOKEN || '';
const EXAROTON_SERVER_ID = process.env.EXAROTON_SERVER_ID || '';
const LEGACY_RULES_FILE = path.join(__dirname, '..', '..', 'data', 'rules.json');
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '';
const MAX_EVENTS = 100;

module.exports = {
  CORS_ORIGIN,
  EXAROTON_API_BASE_URL,
  EXAROTON_API_TOKEN,
  EXAROTON_SERVER_ID,
  FIREBASE_AUTH_BASE_URL,
  FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL,
  FIREBASE_TOKEN_URL,
  FIREBASE_WEB_API_KEY,
  LEGACY_RULES_FILE,
  MAX_EVENTS,
  PORT,
  TIKTOK_USERNAME,
};
