const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/database');

const router = express.Router();

// Configure multer for file uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../data/uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOADS_DIR, req.user.id);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Upload document
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Verify session ownership
    const session = await db.getSession(sessionId);
    if (!session || session.user_id !== req.user.id) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse PDF
    let textContent = '';
    let pageCount = null;

    try {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      textContent = pdfData.text;
      pageCount = pdfData.numpages;
    } catch (parseError) {
      console.error('PDF parse error:', parseError);
      // Continue without text extraction
    }

    // Create document record
    const document = await db.createDocument({
      sessionId,
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      textContent,
      pageCount
    });

    // Update session timestamp
    await db.updateSession(sessionId, {});

    res.json({ document });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get document (download)
router.get('/:id', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify ownership
    if (document.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(document.file_path, document.original_name);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Delete record
    await db.deleteDocument(req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Manually trigger image parsing (placeholder)
router.post('/:id/parse-images', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document || document.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // MinerU integration would go here
    res.json({
      documentId: document.id,
      parseMode: 'text_only',
      markdownLength: 0,
      figureCount: 0,
      figures: []
    });
  } catch (error) {
    console.error('Parse images error:', error);
    res.status(500).json({ error: 'Failed to parse images' });
  }
});

module.exports = router;
