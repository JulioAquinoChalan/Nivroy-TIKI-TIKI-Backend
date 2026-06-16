const express = require('express');
const { auth } = require('../firebase/admin');
const { getBearerToken, requireAuth } = require('../middleware/auth');
const { setActiveUser } = require('../services/userService');
const {
  authPayload,
  callFirebaseAuth,
  refreshFirebaseToken,
  sendEmailVerification,
} = require('../services/firebaseAuthService');
const { normalizeError } = require('../utils/errors');

const router = express.Router();

router.post('/auth/register', async (req, res) => {
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

router.post('/auth/login', async (req, res) => {
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

router.post('/auth/refresh', async (req, res) => {
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

router.post('/auth/send-email-verification', requireAuth, async (req, res) => {
  try {
    await sendEmailVerification(getBearerToken(req));
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: normalizeError(error) });
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
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

module.exports = router;
