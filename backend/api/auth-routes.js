const express = require('express');
const passport = require('passport');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// Google OAuth login
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' })(req, res, next);
  },
  (req, res) => {
    // Generate JWT
    const token = generateToken(req.user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?token=${token}`);
  }
);

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.display_name,
      profilePicture: req.user.profile_picture
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout?.(() => {});
  res.clearCookie('auth_token');
  res.json({ success: true });
});

// Dev login (for testing without Google OAuth)
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (req, res) => {
    try {
      const db = require('../lib/database');
      const { email, name } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const user = await db.findOrCreateUser({
        googleId: `dev-${email}`,
        email,
        displayName: name || email.split('@')[0],
        profilePicture: null
      });

      const token = generateToken(user);
      res.json({ token, user });
    } catch (error) {
      console.error('Dev login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
}

module.exports = router;
