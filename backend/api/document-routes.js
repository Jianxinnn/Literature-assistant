const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/database');
const { mineruService } = require('../lib/mineru-service');

const router = express.Router();

// Configure directories
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../data/uploads');
const FIGURES_DIR = process.env.FIGURES_DIR || path.join(__dirname, '../../data/figures');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(FIGURES_DIR, { recursive: true });

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

// Manually trigger image parsing (MinerU integration)
router.post('/:id/parse-images', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document || document.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check MinerU availability
    if (!mineruService || !mineruService.isAvailable()) {
      return res.status(503).json({
        error: 'MinerU 服务未启用，请配置 MINERU_API_TOKEN 环境变量'
      });
    }

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    console.log('🔄 [ImageParse] 开始图文解析:', document.original_name);

    // Create output directory for this document
    const outputDir = path.join(FIGURES_DIR, req.user.id, document.id);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse with MinerU
    const parseResult = await mineruService.parseLocalFile(
      document.file_path,
      outputDir,
      (progress) => {
        console.log('📊 [ImageParse] 进度:', progress);
      }
    );

    // Extract figures from markdown
    const figures = mineruService.extractFiguresFromMarkdown(
      parseResult.markdown,
      parseResult.images,
      parseResult.contentList
    );

    console.log('📊 [ImageParse] 提取到', figures.length, '个图片');

    // Save figures to database (with canonical numbering F1, F2, ...)
    const savedFigures = [];
    let canonicalIndex = 1;

    for (const fig of figures) {
      const figId = uuidv4();
      const figStats = fig.imagePath && fs.existsSync(fig.imagePath)
        ? fs.statSync(fig.imagePath)
        : null;
      const canonicalLabel = `F${canonicalIndex}`;
      const pageNumber = typeof fig.page === 'number' ? fig.page : 0;
      const caption = fig.caption || fig.label || canonicalLabel;

      await db.createFigure({
        documentId: document.id,
        label: canonicalLabel,
        caption,
        pageNumber,
        imageIndex: canonicalIndex,
        fileName: fig.fileName,
        filePath: fig.imagePath,
        fileSize: figStats?.size || 0
      });

      savedFigures.push({
        id: figId,
        label: canonicalLabel,
        caption,
        fileName: fig.fileName
      });

      canonicalIndex += 1;
    }

    // Update document with markdown content and parse mode
    await db.updateDocumentParseMode(document.id, 'image_aware', parseResult.markdown);

    console.log('✅ [ImageParse] 图文解析完成:', document.id);

    res.json({
      documentId: document.id,
      parseMode: 'image_aware',
      markdownLength: parseResult.markdown.length,
      figureCount: savedFigures.length,
      figures: savedFigures
    });
  } catch (error) {
    console.error('❌ [ImageParse] 错误:', error);
    res.status(500).json({ error: error.message || 'Failed to parse images' });
  }
});

// Get document figures
router.get('/:id/figures', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.id);
    if (!document || document.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const figures = await db.getDocumentFigures(req.params.id);
    res.json({ figures });
  } catch (error) {
    console.error('Get figures error:', error);
    res.status(500).json({ error: 'Failed to get figures' });
  }
});

// Get figure by label
router.get('/:documentId/figures/by-label/:label', async (req, res) => {
  try {
    const { documentId, label } = req.params;

    const document = await db.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const figure = await db.getFigureByLabel(documentId, label);
    if (!figure || !fs.existsSync(figure.file_path)) {
      return res.status(404).json({ error: 'Figure not found' });
    }

    const ext = path.extname(figure.file_name).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = fs.createReadStream(figure.file_path);
    stream.pipe(res);
  } catch (error) {
    console.error('Get figure by label error:', error);
    res.status(500).json({ error: 'Failed to get figure' });
  }
});

module.exports = router;
