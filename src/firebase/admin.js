const path = require('path');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountJson = getFirebaseServiceAccountJson();
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountJson) {
    initializeApp({
      credential: cert(parseFirebaseServiceAccount(serviceAccountJson)),
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

function getFirebaseServiceAccountJson() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  }

  return '';
}

function parseFirebaseServiceAccount(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
  }
}

initializeFirebaseAdmin();

module.exports = {
  auth: getAuth(),
  firestore: getFirestore(),
};
