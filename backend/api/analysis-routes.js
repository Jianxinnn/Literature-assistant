const express = require('express');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const db = require('../lib/database');
const path = require('path');

const router = express.Router();

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

// Stream LLM response
async function streamLLM(provider, messages, onChunk) {
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

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// Build system prompt
function buildSystemPrompt(taskType, customPrompt) {
  const systemDefault = prompts.system?.default || 'You are a helpful research assistant.';

  if (customPrompt) {
    return `${systemDefault}\n\n${customPrompt}`;
  }

  const task = prompts.tasks?.[taskType];
  if (task?.prompt) {
    return `${systemDefault}\n\n${task.prompt}`;
  }

  return systemDefault;
}

// Analyze endpoint (streaming)
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

    // Build context from documents
    let documentContext = '';
    if (session.documents && session.documents.length > 0) {
      for (const doc of session.documents) {
        if (doc.text_content) {
          documentContext += `\n\n--- Document: ${doc.original_name} ---\n${doc.text_content}`;
        }
      }
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(taskType, customPrompt);

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${message}\n\nDocument content:${documentContext}` }
    ];

    // Save user message if provided
    if (message && message.trim()) {
      await db.createMessage({
        id: userMessageId || uuidv4(),
        sessionId,
        role: 'user',
        content: message,
        metadata: JSON.stringify({ taskType })
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Stream response
    let fullContent = '';
    const messageId = uuidv4();

    try {
      fullContent = await streamLLM(provider, messages, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      });

      // Save assistant message
      await db.createMessage({
        id: messageId,
        sessionId,
        role: 'assistant',
        content: fullContent,
        metadata: JSON.stringify({ providerId, taskType })
      });

      // Update session timestamp
      await db.updateSession(sessionId, {});

      // Send done event
      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId,
        content: fullContent,
        warnings: []
      })}\n\n`);
    } catch (llmError) {
      console.error('LLM error:', llmError);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: llmError.message
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Analysis error:', error);
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

// Upload from URL (for arXiv, etc.)
router.post('/upload-from-url', async (req, res) => {
  // This would need implementation for fetching PDFs from URLs
  res.status(501).json({ error: 'URL upload not yet implemented' });
});

module.exports = router;
