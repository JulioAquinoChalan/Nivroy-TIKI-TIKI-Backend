const {
  FIREBASE_AUTH_BASE_URL,
  FIREBASE_EMAIL_VERIFICATION_CONTINUE_URL,
  FIREBASE_TOKEN_URL,
  FIREBASE_WEB_API_KEY,
} = require('../config');

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

module.exports = {
  authPayload,
  callFirebaseAuth,
  refreshFirebaseToken,
  sendEmailVerification,
};
