const jwt = require('jsonwebtoken');
const db = require('../lib/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      displayName: user.display_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
async function authenticate(req, res, next) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Check cookie as fallback
  if (!token && req.cookies?.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Get user from database
  const user = await db.getUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

// Optional authentication (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token && req.cookies?.auth_token) {
    token = req.cookies.auth_token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = await db.getUserById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  JWT_SECRET
};
