require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const cookieParser = require('cookie-parser');

const db = require('./lib/database');
const { generateToken, authenticate, optionalAuth } = require('./middleware/auth');

// Import routes
const authRoutes = require('./api/auth-routes');
const sessionRoutes = require('./api/session-routes');
const documentRoutes = require('./api/document-routes');
const analysisRoutes = require('./api/analysis-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// Session for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await db.findOrCreateUser({
          googleId: profile.id,
          email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
          displayName: profile.displayName,
          profilePicture: profile.photos?.[0]?.value
        });
        done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        done(error, null);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
} else {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', authenticate, sessionRoutes);
app.use('/api/documents', authenticate, documentRoutes);
app.use('/api', authenticate, analysisRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

// Config endpoint
app.get('/api/config', authenticate, async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config/llm-providers.json');
    const config = require(configPath);

    // Filter only enabled providers
    const enabledProviders = Object.entries(config.providers)
      .filter(([_, v]) => v.enabled)
      .map(([k]) => k);

    const providersDetail = {};
    for (const [k, v] of Object.entries(config.providers)) {
      if (v.enabled) {
        providersDetail[k] = {
          multimodal: v.multimodal || false,
          enabled: v.enabled
        };
      }
    }

    res.json({
      config: {
        providers: enabledProviders,
        providersDetail,
        defaultProvider: config.defaultProvider,
        assistantDefaultProvider: config.assistantDefaultProvider || config.defaultProvider,
        upload: {
          maxFileSizeMB: 150,
          allowedMimeTypes: ['application/pdf'],
          allowedExtensions: ['.pdf'],
          cleanupAfterDays: 90
        },
        session: {
          autoTitleLength: 50,
          maxMessagesPerSession: 100,
          defaultPageSize: 20
        }
      }
    });
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// Prompts endpoint
app.get('/api/prompts', authenticate, (req, res) => {
  try {
    const prompts = require('./config/prompts.json');
    res.json({ prompts });
  } catch (error) {
    console.error('Prompts error:', error);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

// Custom prompts endpoints
app.get('/api/custom-prompts', authenticate, async (req, res) => {
  try {
    const prompts = await db.getCustomPrompts(req.user.id);
    res.json({ prompts });
  } catch (error) {
    console.error('Custom prompts error:', error);
    res.status(500).json({ error: 'Failed to load custom prompts' });
  }
});

app.post('/api/custom-prompts', authenticate, async (req, res) => {
  try {
    const { name, prompt } = req.body;
    const item = await db.createCustomPrompt(req.user.id, name, prompt);
    res.json({ prompt: item });
  } catch (error) {
    console.error('Create custom prompt error:', error);
    res.status(500).json({ error: 'Failed to create custom prompt' });
  }
});

app.delete('/api/custom-prompts/:id', authenticate, async (req, res) => {
  try {
    await db.deleteCustomPrompt(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete custom prompt error:', error);
    res.status(500).json({ error: 'Failed to delete custom prompt' });
  }
});

// Community endpoints
app.get('/api/community/settings', authenticate, async (req, res) => {
  try {
    const settings = await db.getCommunitySettings(req.user.id);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/community/settings', authenticate, async (req, res) => {
  try {
    const { shareEnabled } = req.body;
    const settings = await db.updateCommunitySettings(req.user.id, shareEnabled);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.get('/api/community/sessions', optionalAuth, async (req, res) => {
  try {
    const sessions = await db.getPublicSessions(req.query);
    res.json({ sessions, total: sessions.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load public sessions' });
  }
});

// MinerU status (placeholder - actual service would need to be configured)
app.get('/api/mineru/status', authenticate, (req, res) => {
  const available = !!process.env.MINERU_API_TOKEN;
  res.json({
    available,
    message: available ? 'MinerU service available' : 'MinerU service not configured'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Literature Assistant Backend running on port ${PORT}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`   API URL: http://localhost:${PORT}/api`);
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.log('\n⚠️  Google OAuth not configured. See .env.example for setup.');
  }
  console.log('');
});

module.exports = app;
