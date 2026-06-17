const express = require('express');
const { auth } = require('../firebase/admin');
const { asyncHandler } = require('../middleware/errorHandler');
const { getBearerToken, requireAuth } = require('../middleware/auth');
const { setActiveUser } = require('../services/userService');
const {
  authPayload,
  callFirebaseAuth,
  refreshFirebaseToken,
  sendEmailVerification,
} = require('../services/firebaseAuthService');
const { ApiResponse } = require('../utils/ApiResponse');
const { createHttpError } = require('../utils/errors');

const router = express.Router();

router.post('/auth/register', asyncHandler(async (req, res) => {
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
    res.status(201).json(ApiResponse.created({
      message: 'User registered successfully',
      data: authPayload(data),
    }));
  } catch (error) {
    throw createHttpError(400, error.message);
  }
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
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
    res.status(200).json(ApiResponse.success({
      message: 'User logged in successfully',
      data: authPayload(data),
    }));
  } catch (error) {
    throw createHttpError(401, error.message);
  }
}));

router.post('/auth/refresh', asyncHandler(async (req, res) => {
  try {
    const refreshToken = String(req.body.refreshToken || '');
    const data = await refreshFirebaseToken(refreshToken);
    const user = await auth.getUser(data.user_id);
    if (user.emailVerified === true) {
      await setActiveUser({ uid: data.user_id, email: user.email });
    }
    res.status(200).json(ApiResponse.success({
      message: 'Token refreshed successfully',
      data: {
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: Number(data.expires_in || 3600),
        uid: data.user_id,
        email: user.email || '',
        emailVerified: user.emailVerified === true,
      },
    }));
  } catch (error) {
    throw createHttpError(401, error.message);
  }
}));

router.post('/auth/send-email-verification', requireAuth, asyncHandler(async (req, res) => {
  try {
    await sendEmailVerification(getBearerToken(req));
    res.status(200).json(ApiResponse.success({
      message: 'Email verification sent successfully',
      data: {},
    }));
  } catch (error) {
    throw createHttpError(400, error.message);
  }
}));

router.get('/auth/me', requireAuth, asyncHandler(async (req, res) => {
  try {
    const user = await auth.getUser(req.user.uid);
    res.status(200).json(ApiResponse.success({
      message: 'Authenticated user retrieved successfully',
      data: {
        uid: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified === true,
      },
    }));
  } catch (error) {
    throw createHttpError(400, error.message);
  }
}));

module.exports = router;
