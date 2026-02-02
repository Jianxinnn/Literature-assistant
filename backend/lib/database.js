const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/database/literature.db');

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

// Initialize database
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');

  // Users table (Google OAuth)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT,
      profile_picture TEXT,
      auth_provider TEXT DEFAULT 'google',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      config TEXT,
      status TEXT DEFAULT 'active',
      is_public INTEGER DEFAULT 0,
      copy_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      analysis_status TEXT DEFAULT 'idle',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Add view_count column if not exists
  db.run(`ALTER TABLE sessions ADD COLUMN view_count INTEGER DEFAULT 0`, () => {});

  // Add analysis_status column if not exists
  db.run(`ALTER TABLE sessions ADD COLUMN analysis_status TEXT DEFAULT 'idle'`, () => {});

  // Messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Documents table
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      text_content TEXT,
      markdown_content TEXT,
      parse_mode TEXT DEFAULT 'text_only',
      page_count INTEGER,
      uploaded_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Document figures table
  db.run(`
    CREATE TABLE IF NOT EXISTS document_figures (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      label TEXT,
      caption TEXT,
      page_number INTEGER,
      image_index INTEGER,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `);

  // Add width and height columns if not exists
  db.run(`ALTER TABLE document_figures ADD COLUMN width INTEGER`, () => {});
  db.run(`ALTER TABLE document_figures ADD COLUMN height INTEGER`, () => {});

  // Custom prompts table
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_prompts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Community settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS community_settings (
      user_id TEXT PRIMARY KEY,
      share_enabled INTEGER DEFAULT 0,
      enabled_at INTEGER
    )
  `);

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
});

// Promisified helpers
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// User management
async function findOrCreateUser(profile) {
  const now = Date.now();

  let user = await dbGet('SELECT * FROM users WHERE google_id = ?', [profile.googleId]);

  if (user) {
    await dbRun(
      'UPDATE users SET display_name = ?, profile_picture = ?, updated_at = ? WHERE id = ?',
      [profile.displayName, profile.profilePicture, now, user.id]
    );
    return user;
  }

  // Check if email exists
  user = await dbGet('SELECT * FROM users WHERE email = ?', [profile.email]);
  if (user) {
    // Link Google account to existing user
    await dbRun(
      'UPDATE users SET google_id = ?, display_name = ?, profile_picture = ?, updated_at = ? WHERE id = ?',
      [profile.googleId, profile.displayName, profile.profilePicture, now, user.id]
    );
    return await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
  }

  // Create new user
  const userId = uuidv4();
  await dbRun(
    `INSERT INTO users (id, google_id, email, display_name, profile_picture, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, profile.googleId, profile.email, profile.displayName, profile.profilePicture, now, now]
  );

  return await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
}

async function getUserById(id) {
  return await dbGet('SELECT * FROM users WHERE id = ?', [id]);
}

// Session management
async function createSession(userId, title) {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    'INSERT INTO sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title || '新文献分析', now, now]
  );
  return await dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
}

async function getSessions(userId) {
  return await dbAll(
    `SELECT s.*,
      (SELECT COUNT(*) FROM documents WHERE session_id = s.id) as documentCount,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as messageCount
     FROM sessions s
     WHERE s.user_id = ?
     ORDER BY s.updated_at DESC`,
    [userId]
  );
}

async function getSession(sessionId) {
  const session = await dbGet('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) return null;

  const messages = await dbAll('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);
  const documents = await dbAll('SELECT * FROM documents WHERE session_id = ? ORDER BY uploaded_at ASC', [sessionId]);

  return { ...session, messages, documents };
}

async function updateSession(sessionId, data) {
  const updates = [];
  const params = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.config !== undefined) {
    updates.push('config = ?');
    params.push(JSON.stringify(data.config));
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  updates.push('updated_at = ?');
  params.push(Date.now());
  params.push(sessionId);

  await dbRun(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`, params);
  return await getSession(sessionId);
}

async function deleteSession(sessionId) {
  await dbRun('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// Document management
async function createDocument(data) {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    `INSERT INTO documents (id, session_id, user_id, filename, original_name, file_path, file_size, mime_type, text_content, page_count, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.sessionId, data.userId, data.filename, data.originalName, data.filePath, data.fileSize, data.mimeType, data.textContent, data.pageCount, now]
  );
  return await dbGet('SELECT * FROM documents WHERE id = ?', [id]);
}

async function getDocument(documentId) {
  return await dbGet('SELECT * FROM documents WHERE id = ?', [documentId]);
}

async function deleteDocument(documentId) {
  await dbRun('DELETE FROM documents WHERE id = ?', [documentId]);
}

// Message management
async function createMessage(data) {
  const id = data.id || uuidv4();
  const now = Date.now();
  await dbRun(
    'INSERT INTO messages (id, session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.sessionId, data.role, data.content, data.metadata || null, now]
  );
  return await dbGet('SELECT * FROM messages WHERE id = ?', [id]);
}

async function deleteMessage(messageId) {
  await dbRun('DELETE FROM messages WHERE id = ?', [messageId]);
}

// Custom prompts
async function getCustomPrompts(userId) {
  return await dbAll('SELECT * FROM custom_prompts WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

async function createCustomPrompt(userId, name, prompt) {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    'INSERT INTO custom_prompts (id, user_id, name, prompt, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, name, prompt, now]
  );
  return await dbGet('SELECT * FROM custom_prompts WHERE id = ?', [id]);
}

async function deleteCustomPrompt(id) {
  await dbRun('DELETE FROM custom_prompts WHERE id = ?', [id]);
}

// Community settings
async function getCommunitySettings(userId) {
  const settings = await dbGet('SELECT * FROM community_settings WHERE user_id = ?', [userId]);
  return settings || { shareEnabled: false };
}

async function updateCommunitySettings(userId, shareEnabled) {
  const now = Date.now();
  await dbRun(
    `INSERT INTO community_settings (user_id, share_enabled, enabled_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET share_enabled = ?, enabled_at = ?`,
    [userId, shareEnabled ? 1 : 0, now, shareEnabled ? 1 : 0, now]
  );
  return { shareEnabled, enabledAt: now };
}

async function getPublicSessions(params = {}) {
  const { search, limit = 100, offset = 0 } = params;
  let query = `
    SELECT s.*,
      (SELECT COUNT(*) FROM documents WHERE session_id = s.id) as document_count
    FROM sessions s
    WHERE s.is_public = 1
  `;
  const queryParams = [];

  if (search) {
    query += ' AND s.title LIKE ?';
    queryParams.push(`%${search}%`);
  }

  query += ' ORDER BY s.updated_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  return await dbAll(query, queryParams);
}

async function toggleSessionPublic(sessionId, isPublic) {
  await dbRun('UPDATE sessions SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, sessionId]);
}

async function incrementViewCount(sessionId) {
  await dbRun('UPDATE sessions SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?', [sessionId]);
}

async function incrementCopyCount(sessionId) {
  await dbRun('UPDATE sessions SET copy_count = COALESCE(copy_count, 0) + 1 WHERE id = ?', [sessionId]);
}

async function updateAnalysisStatus(sessionId, status) {
  await dbRun('UPDATE sessions SET analysis_status = ?, updated_at = ? WHERE id = ?', [status, Date.now(), sessionId]);
}

async function getDocumentFigures(documentId) {
  return await dbAll('SELECT * FROM document_figures WHERE document_id = ? ORDER BY page_number, image_index', [documentId]);
}

async function getFigure(figureId) {
  return await dbGet('SELECT * FROM document_figures WHERE id = ?', [figureId]);
}

async function getFigureByLabel(documentId, label) {
  // Support both F1 style and numeric style
  const canonicalLabel = label.startsWith('F') ? label : `F${label}`;
  let figure = await dbGet(
    'SELECT * FROM document_figures WHERE document_id = ? AND label = ?',
    [documentId, canonicalLabel]
  );
  if (!figure) {
    // Fallback for older data with different label format
    figure = await dbGet(
      'SELECT * FROM document_figures WHERE document_id = ? AND (label LIKE ? OR label LIKE ?) LIMIT 1',
      [documentId, `%${label}%`, `%Figure ${label}%`]
    );
  }
  return figure;
}

async function createFigure(data) {
  const id = uuidv4();
  const now = Date.now();
  await dbRun(
    `INSERT INTO document_figures (id, document_id, label, caption, page_number, image_index, file_name, file_path, file_size, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.documentId, data.label, data.caption, data.pageNumber, data.imageIndex, data.fileName, data.filePath, data.fileSize, data.width, data.height, now]
  );
  return await dbGet('SELECT * FROM document_figures WHERE id = ?', [id]);
}

async function getMessages(sessionId) {
  return await dbAll('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId]);
}

async function getDocuments(sessionId) {
  return await dbAll('SELECT * FROM documents WHERE session_id = ? ORDER BY uploaded_at ASC', [sessionId]);
}

async function updateDocumentParseMode(documentId, parseMode, markdownContent) {
  await dbRun(
    'UPDATE documents SET parse_mode = ?, markdown_content = ? WHERE id = ?',
    [parseMode, markdownContent, documentId]
  );
}

module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun,
  findOrCreateUser,
  getUserById,
  createSession,
  getSessions,
  getSession,
  updateSession,
  deleteSession,
  createDocument,
  getDocument,
  deleteDocument,
  createMessage,
  deleteMessage,
  getCustomPrompts,
  createCustomPrompt,
  deleteCustomPrompt,
  getCommunitySettings,
  updateCommunitySettings,
  getPublicSessions,
  toggleSessionPublic,
  incrementViewCount,
  incrementCopyCount,
  updateAnalysisStatus,
  getDocumentFigures,
  getFigure,
  getFigureByLabel,
  createFigure,
  getMessages,
  getDocuments,
  updateDocumentParseMode
};
