const { auth } = require('../firebase/admin');
const { setActiveUser } = require('../services/userService');

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Authorization token is required.' });
      return;
    }

    req.user = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: 'Invalid or expired authorization token.' });
  }
}

async function requireVerifiedEmail(req, res, next) {
  if (req.user?.email_verified !== true) {
    res.status(403).json({ ok: false, error: 'Email verification is required.' });
    return;
  }
  await setActiveUser(req.user);
  next();
}

module.exports = {
  getBearerToken,
  requireAuth,
  requireVerifiedEmail,
};
