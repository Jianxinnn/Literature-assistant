const express = require('express');
const db = require('../lib/database');

const router = express.Router();

// Get all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await db.getSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

// Create session
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const session = await db.createSession(req.user.id, title);
    res.json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by ID
router.get('/:id', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Check ownership
    if (session.user_id !== req.user.id && !session.is_public) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// Update session
router.patch('/:id', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const updated = await db.updateSession(req.params.id, req.body);
    res.json({ session: updated });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await db.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Toggle session public
router.patch('/:id/public', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await db.toggleSessionPublic(req.params.id, req.body.isPublic);
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle public error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// AI rename session
router.post('/:id/title/ai', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get first document name as title (simple implementation)
    let title = session.title;
    if (session.documents && session.documents.length > 0) {
      const firstDoc = session.documents[0];
      title = firstDoc.original_name.replace(/\.pdf$/i, '').substring(0, 50);
    }

    await db.updateSession(req.params.id, { title });
    res.json({ title });
  } catch (error) {
    console.error('AI rename error:', error);
    res.status(500).json({ error: 'Failed to rename session' });
  }
});

module.exports = router;
