const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/database');

const router = express.Router();

// Configuration
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../data/uploads');
const FIGURES_DIR = process.env.FIGURES_DIR || path.join(__dirname, '../../data/figures');

// Ensure directories exist
[UPLOADS_DIR, FIGURES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Load prompts
let prompts = {};
try {
  prompts = require('../config/prompts.json');
} catch (e) {
  console.warn('Could not load prompts.json');
}

// Load LLM providers config
let llmConfig = { providers: {}, defaultProvider: null };
try {
  llmConfig = require('../config/llm-providers.json');
} catch (e) {
  console.warn('Could not load llm-providers.json');
}

// Get provider config
function getProvider(providerId) {
  const providers = llmConfig.providers || {};
  return providers[providerId] || providers[llmConfig.defaultProvider] || null;
}

// URL helpers for PDF download
const SUPPORTED_PDF_SOURCES = ['arxiv', 'openreview', 'nature'];

function normalizeHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
  return `https://${raw}`;
}

function sanitizeFilenameBase(input) {
  const raw = String(input || '').trim();
  const cleaned = raw
    .replace(/^https?:\/\//i, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
  return cleaned || 'paper';
}

function isAllowedPdfHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'arxiv.org' || host.endsWith('.arxiv.org')) return true;
  if (host === 'openreview.net' || host.endsWith('.openreview.net')) return true;
  if (host === 'nature.com' || host.endsWith('.nature.com')) return true;
  if (host === 'link.springer.com') return true;
  if (host === 'static-content.springer.com') return true;
  if (host === 'media.springernature.com') return true;
  return false;
}

function resolvePdfUrlFromSupportedSources(rawUrl) {
  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) return null;

  let u;
  try {
    u = new URL(normalized);
  } catch {
    return null;
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.protocol === 'http:') u.protocol = 'https:';

  const host = u.hostname.toLowerCase();

  // arXiv
  const isArxiv = host === 'arxiv.org' || host === 'www.arxiv.org';
  if (isArxiv) {
    const pathname = u.pathname || '';
    let id = '';
    if (pathname.startsWith('/abs/')) id = pathname.slice('/abs/'.length);
    else if (pathname.startsWith('/pdf/')) id = pathname.slice('/pdf/'.length);
    else return null;

    id = id.replace(/\/+$/, '').replace(/\.pdf$/i, '');
    if (!id) return null;

    const pdfUrl = `https://arxiv.org/pdf/${id}.pdf`;
    const originalName = `arxiv-${sanitizeFilenameBase(id)}.pdf`;
    return { source: 'arxiv', pdfUrl, originalName, normalizedInputUrl: u.toString() };
  }

  // OpenReview
  if (host === 'openreview.net') {
    const pathname = u.pathname || '';
    const id = u.searchParams.get('id') || u.searchParams.get('noteId') || '';
    if (!id) return null;
    if (!pathname.startsWith('/forum') && !pathname.startsWith('/pdf')) return null;

    const pdfUrl = `https://openreview.net/pdf?id=${encodeURIComponent(id)}`;
    const originalName = `openreview-${sanitizeFilenameBase(id)}.pdf`;
    return { source: 'openreview', pdfUrl, originalName, normalizedInputUrl: u.toString() };
  }

  // Nature
  const isNature = host === 'nature.com' || host.endsWith('.nature.com');
  if (isNature) {
    const pathname = u.pathname || '';
    if (!pathname.includes('/articles/')) return null;

    const normalizedPath = pathname.replace(/\/+$/, '');
    const pdfPath = normalizedPath.toLowerCase().endsWith('.pdf') ? normalizedPath : `${normalizedPath}.pdf`;
    const pdfUrl = `https://www.nature.com${pdfPath}`;

    const slug = (pdfPath.split('/').pop() || 'nature-paper.pdf').replace(/\.pdf$/i, '');
    const originalName = `nature-${sanitizeFilenameBase(slug)}.pdf`;
    return { source: 'nature', pdfUrl, originalName, normalizedInputUrl: u.toString() };
  }

  return null;
}

async function downloadPdfToFile(pdfUrl, filePath, options = {}) {
  const maxBytes = options.maxBytes || 150 * 1024 * 1024;
  const timeoutMs = options.timeoutMs || 120000;

  return new Promise((resolve, reject) => {
    const url = new URL(pdfUrl);
    const lib = url.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/pdf,*/*;q=0.9'
      },
      timeout: timeoutMs
    };

    const req = lib.request(requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, pdfUrl);
        if (!isAllowedPdfHost(redirectUrl.hostname)) {
          reject(new Error(`Redirect to disallowed host: ${redirectUrl.hostname}`));
          return;
        }
        downloadPdfToFile(redirectUrl.toString(), filePath, options)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const contentLength = parseInt(res.headers['content-length'], 10);
      if (contentLength && contentLength > maxBytes) {
        reject(new Error(`File too large: ${contentLength} bytes`));
        return;
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const fileStream = fs.createWriteStream(filePath);
      let receivedBytes = 0;

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) {
          res.destroy();
          fileStream.close();
          fs.unlinkSync(filePath);
          reject(new Error('File exceeds maximum size'));
          return;
        }
        fileStream.write(chunk);
      });

      res.on('end', () => {
        fileStream.end(() => {
          // Verify it's a PDF
          const fd = fs.openSync(filePath, 'r');
          const header = Buffer.alloc(10);
          fs.readSync(fd, header, 0, 10, 0);
          fs.closeSync(fd);

          if (!header.toString().includes('%PDF')) {
            fs.unlinkSync(filePath);
            reject(new Error('Downloaded content is not a PDF'));
            return;
          }

          resolve({ fileSize: receivedBytes, mimeType: 'application/pdf' });
        });
      });

      res.on('error', (err) => {
        fileStream.close();
        try { fs.unlinkSync(filePath); } catch {}
        reject(err);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Stream LLM response with abort signal support
async function streamLLM(provider, messages, onChunk, signal) {
  const baseUrl = process.env[provider.baseUrlEnv] || provider.baseUrl;
  const apiKey = process.env[provider.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider.name}`);
  }

  const requestBody = JSON.stringify({
    model: provider.model,
    messages,
    stream: true,
    temperature: provider.temperature || 0.7,
    max_tokens: provider.maxTokens || 8000
  });

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'));
      return;
    }

    const url = new URL(baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          reject(new Error(`LLM API error: ${res.statusCode} - ${body}`));
        });
        return;
      }

      let buffer = '';
      let fullContent = '';

      res.on('data', (chunk) => {
        if (signal?.aborted) {
          res.destroy();
          return;
        }

        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onChunk(content);
              }
            } catch {}
          }
        }
      });

      res.on('end', () => {
        resolve(fullContent);
      });
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      }, { once: true });
    }

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// Non-streaming fallback
async function callLLM(provider, messages) {
  const baseUrl = process.env[provider.baseUrlEnv] || provider.baseUrl;
  const apiKey = process.env[provider.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`API key not configured for ${provider.name}`);
  }

  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const requestBody = JSON.stringify({
      model: provider.model,
      messages,
      stream: false,
      temperature: provider.temperature || 0.7,
      max_tokens: provider.maxTokens || 8000
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`LLM API error: ${res.statusCode} - ${body}`));
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(data.choices?.[0]?.message?.content || '');
        } catch (e) {
          reject(new Error('Failed to parse LLM response'));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// Build user prompt with content
function buildUserPrompt(taskType, customPrompt, message, documentContext) {
  const rawMessage = (message || '').trim();
  const contentForPrompt = documentContext || '（当前会话下暂无可用文献正文内容）';

  if (taskType && prompts.tasks?.[taskType]) {
    const taskPrompt = String(prompts.tasks[taskType].prompt || '');
    const hasContentPlaceholder = taskPrompt.includes('{content}');
    return hasContentPlaceholder
      ? taskPrompt.replace('{content}', contentForPrompt)
      : `${taskPrompt}\n\n---\n\n文献内容：\n${contentForPrompt}`;
  }

  if (customPrompt) {
    const prompt = String(customPrompt || '');
    const hasContentPlaceholder = prompt.includes('{content}');
    return hasContentPlaceholder
      ? prompt.replace('{content}', contentForPrompt)
      : `${prompt}\n\n---\n\n文献内容：\n${contentForPrompt}`;
  }

  if (documentContext) {
    return rawMessage
      ? `${rawMessage}\n\n参考文献内容：\n${documentContext}`
      : `请分析以下文献内容：\n${documentContext}`;
  }

  return rawMessage || '请分析上传的文献';
}

// Generate session title
async function generateSessionTitle(provider, userContent, assistantContent) {
  try {
    const prompt = `请基于以下对话生成一个简洁的中文标题（不超过10个字），不要出现引号和标点：

用户：${(userContent || '').slice(0, 200)}
助手：${(assistantContent || '').slice(0, 400)}

请只输出标题，不要有其他内容。`;

    const messages = [
      { role: 'system', content: '你是一个标题生成助手。' },
      { role: 'user', content: prompt }
    ];

    let title = await callLLM(provider, messages);
    title = (title || '').replace(/^#+\s*/g, '').replace(/[\s\p{P}]+$/u, '').trim();
    if (title.length > 10) title = title.slice(0, 10);
    return title || '新对话';
  } catch (e) {
    console.error('Title generation error:', e);
    return '新对话';
  }
}

// Analyze endpoint (streaming with heartbeat)
router.post('/analyze', async (req, res) => {
  const { sessionId, message, taskType, providerId, customPrompt, userMessageId } = req.body;

  try {
    // Verify session access
    const session = await db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get provider
    const provider = getProvider(providerId);
    if (!provider || !provider.enabled) {
      return res.status(400).json({ error: 'Provider not available' });
    }

    // Update analysis status
    await db.updateAnalysisStatus(sessionId, 'analyzing');

    // Build context from documents
    let documentContext = '';
    if (session.documents && session.documents.length > 0) {
      documentContext = session.documents.map((doc, idx) => {
        const content = doc.markdown_content || doc.text_content || '';
        return `=== 文档 ${idx + 1}: ${doc.original_name} ===\n${content}`;
      }).join('\n\n');
    }

    // Build system prompt
    const systemPrompt = prompts.system?.default || 'You are a helpful research assistant.';

    // Build user prompt
    const userPrompt = buildUserPrompt(taskType, customPrompt, message, documentContext);

    // Build messages
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Save user message if user explicitly typed something
    const rawMessage = (message || '').trim();
    const isSummaryTask = !!taskType || !!customPrompt;
    const isImplicitMessage = !rawMessage || rawMessage === '请分析上传的文献';

    if (!isImplicitMessage) {
      await db.createMessage({
        id: userMessageId || uuidv4(),
        sessionId,
        role: 'user',
        content: rawMessage,
        metadata: JSON.stringify({ taskType, customPrompt: !!customPrompt })
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Initial comment
    res.write(`: connected ${Date.now()}\n\n`);

    // Heartbeat to keep connection alive
    let clientClosed = false;
    const heartbeat = setInterval(() => {
      if (!clientClosed) {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch (e) {
          clearInterval(heartbeat);
        }
      }
    }, 15000);

    // Abort controller for upstream request
    const controller = { aborted: false };
    req.on('close', () => {
      clientClosed = true;
      controller.aborted = true;
      clearInterval(heartbeat);
    });

    // Stream response
    let fullContent = '';
    const messageId = uuidv4();
    const warnings = [];

    try {
      let hasChunk = false;

      fullContent = await streamLLM(provider, chatMessages, (chunk) => {
        hasChunk = true;
        if (!clientClosed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      }, controller);

      // Fallback if no streaming chunks received
      if (!hasChunk && !fullContent) {
        console.warn('No streaming chunks received, using fallback');
        try {
          const finalContent = await callLLM(provider, chatMessages);
          if (finalContent) {
            const chunkSize = 180;
            for (let i = 0; i < finalContent.length; i += chunkSize) {
              if (clientClosed) break;
              const piece = finalContent.slice(i, i + chunkSize);
              fullContent += piece;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: piece })}\n\n`);
              await new Promise(r => setTimeout(r, 20));
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback failed:', fallbackErr);
        }
      }

      if (!fullContent || fullContent.trim().length === 0) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: '模型无输出或响应超时，请切换模型后重试' })}\n\n`);
      } else {
        // Save assistant message
        await db.createMessage({
          id: messageId,
          sessionId,
          role: 'assistant',
          content: fullContent,
          metadata: JSON.stringify({ providerId, taskType, customPrompt: !!customPrompt, warnings })
        });

        // Update session
        await db.updateSession(sessionId, {});
        await db.updateAnalysisStatus(sessionId, 'completed');

        // Auto-generate title if needed
        if ((!session.title || session.title === '新文献分析' || session.title === '新对话') && isSummaryTask) {
          try {
            const title = await generateSessionTitle(provider, rawMessage, fullContent);
            if (title) await db.updateSession(sessionId, { title });
          } catch {}
        }

        // Send done event
        res.write(`data: ${JSON.stringify({
          type: 'done',
          messageId,
          content: fullContent,
          warnings
        })}\n\n`);
      }
    } catch (llmError) {
      console.error('LLM error:', llmError);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: llmError.message
      })}\n\n`);
      await db.updateAnalysisStatus(sessionId, 'failed');
    }

    clearInterval(heartbeat);
    res.end();
  } catch (error) {
    console.error('Analysis error:', error);
    if (req.body?.sessionId) {
      try {
        await db.updateAnalysisStatus(req.body.sessionId, 'failed');
      } catch {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analysis failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Delete message
router.delete('/messages/:id', async (req, res) => {
  try {
    await db.deleteMessage(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Upload from URL (arXiv, OpenReview, Nature)
router.post('/upload-from-url', async (req, res) => {
  let downloadedFilePath = null;

  try {
    const { sessionId, url: inputUrl } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    if (!inputUrl) {
      return res.status(400).json({ error: 'URL required' });
    }

    // Verify session
    const session = await db.getSession(sessionId);
    if (!session || session.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const resolved = resolvePdfUrlFromSupportedSources(inputUrl);
    if (!resolved || !SUPPORTED_PDF_SOURCES.includes(resolved.source)) {
      return res.status(400).json({
        error: 'Unsupported URL. Supported: arXiv, OpenReview, Nature.'
      });
    }

    const uploadDir = path.join(UPLOADS_DIR, req.user.id);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}.pdf`;
    downloadedFilePath = path.join(uploadDir, filename);

    const { fileSize, mimeType } = await downloadPdfToFile(resolved.pdfUrl, downloadedFilePath);

    // Extract PDF text
    let textContent = '';
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(downloadedFilePath);
      const pdfData = await pdfParse(dataBuffer);
      textContent = pdfData.text;
    } catch (parseError) {
      console.error('PDF parse error:', parseError);
    }

    // Create document record
    const document = await db.createDocument({
      sessionId,
      userId: req.user.id,
      filename,
      originalName: resolved.originalName,
      filePath: downloadedFilePath,
      fileSize,
      mimeType,
      textContent
    });

    res.json({
      document,
      resolved: { source: resolved.source, pdfUrl: resolved.pdfUrl }
    });
  } catch (error) {
    console.error('Upload-from-url error:', error);
    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      try { fs.unlinkSync(downloadedFilePath); } catch {}
    }
    res.status(500).json({ error: error.message || 'Upload from URL failed' });
  }
});

// Community copy endpoint
router.post('/community/copy/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get original session (must be public)
    const originalSession = await db.getSession(sessionId);
    if (!originalSession || !originalSession.is_public) {
      return res.status(404).json({ error: 'Session not found or not public' });
    }

    if (originalSession.user_id === req.user.id) {
      return res.status(400).json({ error: '不能复制自己的文献' });
    }

    const now = Date.now();
    const newSessionId = uuidv4();

    // Create new session
    const newSession = await db.createSession(req.user.id, `${originalSession.title || '未命名文献'} (来自大家看)`);

    // Copy documents (reference same file path)
    const originalDocs = await db.getDocuments(sessionId);
    for (const doc of originalDocs) {
      await db.createDocument({
        sessionId: newSession.id,
        userId: req.user.id,
        filename: doc.filename,
        originalName: doc.original_name,
        filePath: doc.file_path,
        fileSize: doc.file_size,
        mimeType: doc.mime_type,
        textContent: doc.text_content
      });
    }

    // Copy only blog-type messages (those with taskType)
    const originalMessages = await db.getMessages(sessionId);
    for (const msg of originalMessages) {
      let isBlogContent = false;
      try {
        const meta = msg.metadata ? JSON.parse(msg.metadata) : {};
        isBlogContent = !!meta.taskType;
      } catch {}

      if (isBlogContent) {
        await db.createMessage({
          sessionId: newSession.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata
        });
      }
    }

    // Increment copy count
    await db.incrementCopyCount(sessionId);

    // Get new session with data
    const result = await db.getSession(newSession.id);

    res.json({ session: result });
  } catch (error) {
    console.error('Copy session error:', error);
    res.status(500).json({ error: 'Failed to copy session' });
  }
});

// Community view increment
router.post('/community/view/:sessionId', async (req, res) => {
  try {
    await db.incrementViewCount(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to increment view count' });
  }
});

// Download AI response as Markdown
router.get('/download/ai-response/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await db.dbGet(`
      SELECT m.*, s.title as session_title, s.user_id
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.id = ? AND s.user_id = ?
    `, [messageId, req.user.id]);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const content = message.content || '';
    const title = message.session_title || 'AI-Analysis';
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'AI-Analysis';
    const timestamp = new Date().toISOString().slice(0, 10);

    const mdContent = `# ${title}\n\n${content}\n\n---\n*Generated by Literature Assistant · ${timestamp}*\n`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_${timestamp}.md"`);
    res.send(mdContent);
  } catch (error) {
    console.error('Download AI response error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download original PDF
router.get('/download/original-pdf/:documentId', async (req, res) => {
  try {
    const document = await db.getDocument(req.params.documentId);

    if (!document || document.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', document.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.original_name)}"`);

    const fileStream = fs.createReadStream(document.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check download availability
router.get('/download/availability/:sessionId', async (req, res) => {
  try {
    const session = await db.getSession(req.params.sessionId);

    if (!session || session.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const documents = session.documents || [];
    const messages = session.messages || [];

    const summaryMessages = messages.filter(m => {
      try {
        const meta = m.metadata ? JSON.parse(m.metadata) : {};
        return !!meta.taskType || !!meta.customPrompt;
      } catch {
        return false;
      }
    });

    const hasMineruParsed = documents.some(d => d.parse_mode === 'image_aware');

    res.json({
      availability: {
        aiResponseMd: summaryMessages.length > 0,
        originalPdf: documents.length > 0,
        mineruMarkdown: hasMineruParsed,
        mineruFolder: hasMineruParsed
      },
      documents: documents.map(d => ({
        id: d.id,
        name: d.original_name,
        hasMineruParsed: d.parse_mode === 'image_aware'
      })),
      latestMessageId: summaryMessages.length > 0 ? summaryMessages[summaryMessages.length - 1].id : null
    });
  } catch (error) {
    console.error('Download availability error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
