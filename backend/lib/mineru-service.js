'use strict';

/**
 * MinerU PDF 解析服务
 *
 * 提供与 MinerU API (mineru.net) 的集成，用于高质量 PDF 解析
 * 支持提取文本、图片、表格、公式等结构化内容
 *
 * API 文档: https://mineru.net/apiManage/docs
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const dns = require('dns');
const { v4: uuidv4 } = require('uuid');

function getMinerUToken() {
  const env = process.env.MINERU_API_TOKEN;
  if (env != null && String(env).length > 0) return String(env);
  return '';
}

const EXTERNAL_DNS_SERVERS = String(
  process.env.DNS_SERVERS ||
    '8.8.8.8,1.1.1.1,114.114.114.114,223.5.5.5,223.6.6.6'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let externalDnsResolver = null;
function getExternalDnsResolver() {
  if (externalDnsResolver) return externalDnsResolver;
  externalDnsResolver = new dns.Resolver();
  try {
    externalDnsResolver.setServers(EXTERNAL_DNS_SERVERS);
  } catch {}
  return externalDnsResolver;
}

function shouldUseExternalDns(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  return h === 'cdn-mineru.openxlab.org.cn' || h.endsWith('.openxlab.org.cn') || h.endsWith('.cdngslb.com');
}

function lookupWithExternalDns(hostname, options, callback) {
  let opts = options;
  let cb = callback;
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if (!shouldUseExternalDns(hostname)) {
    return dns.lookup(hostname, opts, cb);
  }

  const resolver = getExternalDnsResolver();
  const isObjectOpts = typeof opts === 'object' && opts !== null;
  const family = isObjectOpts ? opts.family : opts;
  const wantsAll = isObjectOpts && opts.all === true;

  const resolve4 = () =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), 3000);
      resolver.resolve4(hostname, (err, addresses) => {
        clearTimeout(timer);
        resolve(err ? [] : addresses || []);
      });
    });
  const resolve6 = () =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), 3000);
      resolver.resolve6(hostname, (err, addresses) => {
        clearTimeout(timer);
        resolve(err ? [] : addresses || []);
      });
    });

  (async () => {
    if (wantsAll) {
      const v4 = family === 6 ? [] : await resolve4();
      const v6 = family === 4 ? [] : await resolve6();
      const addrs = [
        ...v4.map((a) => ({ address: a, family: 4 })),
        ...v6.map((a) => ({ address: a, family: 6 })),
      ].filter((x) => x && typeof x.address === 'string' && x.address.length > 0);

      if (addrs.length > 0) return cb(null, addrs);
      return dns.lookup(hostname, opts, cb);
    }

    const v4 = family === 6 ? [] : await resolve4();
    const v6 = family === 4 ? [] : await resolve6();
    const addr = (v4 && v4[0]) || (v6 && v6[0]) || null;
    if (addr && typeof addr === 'string' && addr.length > 0) {
      return cb(null, addr, v4 && v4[0] ? 4 : 6);
    }
    return dns.lookup(hostname, opts, cb);
  })().catch(() => dns.lookup(hostname, opts, cb));
}

function downloadUrlToBuffer(urlString, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 120000;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 300 * 1024 * 1024;
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : 5;

  const doRequest = (currentUrlString, redirectsLeft) =>
    new Promise((resolve, reject) => {
      let u;
      try {
        u = new URL(currentUrlString);
      } catch (e) {
        reject(e);
        return;
      }

      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;

      const totalTimeout = setTimeout(() => {
        req.destroy(new Error('下载超时'));
      }, timeoutMs);

      const req = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (isHttps ? 443 : 80),
          path: `${u.pathname}${u.search || ''}`,
          method: 'GET',
          headers: {
            Accept: '*/*',
            'User-Agent': 'literature-assistant/mineru-service'
          },
          lookup: lookupWithExternalDns,
        },
        (res) => {
          const status = res.statusCode || 0;
          const loc = res.headers.location;

          if ([301, 302, 303, 307, 308].includes(status) && loc && redirectsLeft > 0) {
            clearTimeout(totalTimeout);
            res.resume();
            const nextUrl = new URL(loc, u).toString();
            doRequest(nextUrl, redirectsLeft - 1).then(resolve, reject);
            return;
          }

          if (status < 200 || status >= 300) {
            clearTimeout(totalTimeout);
            res.resume();
            reject(new Error(`下载失败: HTTP ${status}`));
            return;
          }

          const chunks = [];
          let total = 0;
          let lastProgressTime = Date.now();
          const contentLength = parseInt(res.headers['content-length'] || '0', 10);

          res.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
              clearTimeout(totalTimeout);
              req.destroy(new Error(`下载文件过大: > ${maxBytes} bytes`));
              return;
            }
            chunks.push(chunk);

            const now = Date.now();
            if (now - lastProgressTime > 5000) {
              lastProgressTime = now;
              const progress = contentLength > 0
                ? `${Math.round(total / contentLength * 100)}%`
                : `${Math.round(total / 1024 / 1024)}MB`;
              console.log(`📥 [MinerU] 下载进度: ${progress}`);
            }
          });

          res.on('end', () => {
            clearTimeout(totalTimeout);
            resolve(Buffer.concat(chunks));
          });

          res.on('error', (err) => {
            clearTimeout(totalTimeout);
            reject(err);
          });
        }
      );

      req.setTimeout(30000, () => {
        clearTimeout(totalTimeout);
        req.destroy(new Error('下载空闲超时（30秒无数据）'));
      });

      req.on('error', (err) => {
        clearTimeout(totalTimeout);
        reject(err);
      });

      req.end();
    });

  return doRequest(urlString, maxRedirects);
}

// Configuration
const MINERU_CONFIG = {
  API_BASE: 'https://mineru.net/api/v4',
  EXTRACT_TASK_URL: 'https://mineru.net/api/v4/extract/task',
  FILE_URLS_BATCH_URL: 'https://mineru.net/api/v4/file-urls/batch',
  BATCH_RESULTS_URL: 'https://mineru.net/api/v4/extract-results/batch',
  POLL_INTERVAL: 3000,
  MAX_POLL_ATTEMPTS: 200,
  DEFAULT_MODEL_VERSION: 'pipeline',
  DEFAULT_LANGUAGE: 'en',
  PARSE_TIMEOUT: 600000,
  DOWNLOAD_TIMEOUT: 1200000,
  DOWNLOAD_RETRIES: 3
};

class MinerUService {
  constructor() {
    this._warnedMissingToken = false;
  }

  isAvailable() {
    const token = getMinerUToken();
    const enabled = !!(token && String(token).length > 0);
    if (!enabled && !this._warnedMissingToken) {
      this._warnedMissingToken = true;
      console.warn('⚠️  MinerU API Token 未配置，图文解析功能将不可用');
      console.warn('   请配置环境变量: MINERU_API_TOKEN');
    }
    return enabled;
  }

  _getHeaders() {
    const token = getMinerUToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': '*/*'
    };
  }

  async createTaskFromUrl(fileUrl, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('MinerU 服务未启用，请配置 MINERU_API_TOKEN');
    }

    const requestBody = {
      url: fileUrl,
      model_version: options.modelVersion || MINERU_CONFIG.DEFAULT_MODEL_VERSION,
      language: options.language || MINERU_CONFIG.DEFAULT_LANGUAGE,
      enable_formula: options.enableFormula !== false,
      enable_table: options.enableTable !== false,
      ...(options.dataId && { data_id: options.dataId }),
      ...(options.pageRanges && { page_ranges: options.pageRanges }),
      ...(options.callback && { callback: options.callback, seed: options.seed || uuidv4() })
    };

    console.log('📤 [MinerU] 创建解析任务:', { url: fileUrl.substring(0, 50) + '...' });

    const response = await fetch(MINERU_CONFIG.EXTRACT_TASK_URL, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (result.code !== 0) {
      console.error('❌ [MinerU] 创建任务失败:', result);
      throw new Error(`MinerU API 错误: ${result.msg || '未知错误'} (code: ${result.code})`);
    }

    console.log('✅ [MinerU] 任务创建成功:', result.data.task_id);
    return { taskId: result.data.task_id };
  }

  async getTaskStatus(taskId) {
    if (!this.isAvailable()) {
      throw new Error('MinerU 服务未启用');
    }

    const url = `${MINERU_CONFIG.API_BASE}/extract/task/${taskId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders()
    });

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`MinerU API 错误: ${result.msg || '未知错误'}`);
    }

    const data = result.data;
    return {
      taskId: data.task_id,
      dataId: data.data_id,
      state: data.state,
      fullZipUrl: data.full_zip_url,
      errMsg: data.err_msg,
      progress: data.extract_progress
    };
  }

  async waitForCompletion(taskId, onProgress = null) {
    let attempts = 0;

    while (attempts < MINERU_CONFIG.MAX_POLL_ATTEMPTS) {
      const status = await this.getTaskStatus(taskId);

      if (onProgress && status.progress) {
        onProgress({
          state: status.state,
          extractedPages: status.progress.extracted_pages,
          totalPages: status.progress.total_pages,
          startTime: status.progress.start_time
        });
      }

      if (status.state === 'done') {
        console.log('✅ [MinerU] 解析完成:', status.fullZipUrl?.substring(0, 60) + '...');
        return { fullZipUrl: status.fullZipUrl };
      }

      if (status.state === 'failed') {
        throw new Error(`MinerU 解析失败: ${status.errMsg || '未知错误'}`);
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, MINERU_CONFIG.POLL_INTERVAL));
    }

    throw new Error('MinerU 解析超时');
  }

  async createBatchUpload(files, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('MinerU 服务未启用');
    }

    const fileInfos = files.map((f, idx) => ({
      name: path.basename(f.filePath),
      data_id: f.dataId || `file_${idx}_${Date.now()}`
    }));

    const requestBody = {
      files: fileInfos,
      model_version: options.modelVersion || MINERU_CONFIG.DEFAULT_MODEL_VERSION,
      language: options.language || MINERU_CONFIG.DEFAULT_LANGUAGE,
      ...(options.callback && { callback: options.callback, seed: options.seed || uuidv4() })
    };

    console.log('📤 [MinerU] 申请批量上传 URL:', fileInfos.length, '个文件');

    const response = await fetch(MINERU_CONFIG.FILE_URLS_BATCH_URL, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (result.code !== 0) {
      console.error('❌ [MinerU] 申请上传 URL 失败:', result);
      throw new Error(`MinerU API 错误: ${result.msg || '未知错误'}`);
    }

    const { batch_id: batchId, file_urls: fileUrls } = result.data;
    console.log('✅ [MinerU] 获取上传 URL 成功, batchId:', batchId);

    // Upload files
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i].filePath;
      const uploadUrl = fileUrls[i];

      console.log(`📤 [MinerU] 上传文件 ${i + 1}/${files.length}: ${path.basename(filePath)}`);

      const fileBuffer = fs.readFileSync(filePath);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileBuffer
      });

      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败: ${path.basename(filePath)}`);
      }
    }

    console.log('✅ [MinerU] 所有文件上传完成');
    return { batchId };
  }

  async getBatchStatus(batchId) {
    if (!this.isAvailable()) {
      throw new Error('MinerU 服务未启用');
    }

    const url = `${MINERU_CONFIG.BATCH_RESULTS_URL}/${batchId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this._getHeaders()
    });

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`MinerU API 错误: ${result.msg || '未知错误'}`);
    }

    return result.data.extract_result.map(item => ({
      fileName: item.file_name,
      state: item.state,
      fullZipUrl: item.full_zip_url,
      errMsg: item.err_msg,
      dataId: item.data_id,
      progress: item.extract_progress
    }));
  }

  async waitForBatchCompletion(batchId, onProgress = null) {
    let attempts = 0;

    while (attempts < MINERU_CONFIG.MAX_POLL_ATTEMPTS) {
      const results = await this.getBatchStatus(batchId);

      if (onProgress) {
        onProgress(results);
      }

      const allDone = results.every(r => r.state === 'done' || r.state === 'failed');

      if (allDone) {
        const failed = results.filter(r => r.state === 'failed');
        if (failed.length > 0) {
          console.warn('⚠️  [MinerU] 部分文件解析失败:', failed.map(f => f.fileName));
        }

        const successful = results.filter(r => r.state === 'done');
        console.log('✅ [MinerU] 批量解析完成:', successful.length, '/', results.length);
        return successful;
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, MINERU_CONFIG.POLL_INTERVAL));
    }

    throw new Error('MinerU 批量解析超时');
  }

  async downloadAndExtractResults(fullZipUrl, outputDir) {
    const AdmZip = require('adm-zip');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('📥 [MinerU] 下载解析结果...');

    let buffer;
    let lastError;

    for (let attempt = 1; attempt <= MINERU_CONFIG.DOWNLOAD_RETRIES; attempt++) {
      try {
        console.log(`📥 [MinerU] 下载尝试 ${attempt}/${MINERU_CONFIG.DOWNLOAD_RETRIES}...`);
        buffer = await downloadUrlToBuffer(fullZipUrl, {
          timeoutMs: MINERU_CONFIG.DOWNLOAD_TIMEOUT,
          maxBytes: 300 * 1024 * 1024,
          maxRedirects: 5
        });
        console.log(`✅ [MinerU] 下载成功 (${Math.round(buffer.length / 1024 / 1024)}MB)`);
        break;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️  [MinerU] 下载失败 (尝试 ${attempt}/${MINERU_CONFIG.DOWNLOAD_RETRIES}):`, error.message);

        if (attempt < MINERU_CONFIG.DOWNLOAD_RETRIES) {
          const waitMs = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
          console.log(`⏳ [MinerU] 等待 ${waitMs/1000}s 后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }
    }

    if (!buffer) {
      throw new Error(`下载失败，已重试 ${MINERU_CONFIG.DOWNLOAD_RETRIES} 次: ${lastError?.message || '未知错误'}`);
    }

    const zip = new AdmZip(buffer);
    zip.extractAllTo(outputDir, true);

    console.log('✅ [MinerU] 解压完成:', outputDir);

    let markdownPath = null;
    let jsonPath = null;
    let imagesDir = null;

    const findFiles = (dir) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (item.name === 'images') {
            imagesDir = fullPath;
          } else {
            findFiles(fullPath);
          }
        } else if (item.name.endsWith('.md') && !item.name.includes('_middle')) {
          markdownPath = fullPath;
        } else if (item.name.endsWith('_content_list.json') || item.name.endsWith('.json')) {
          if (!jsonPath || item.name.endsWith('_content_list.json')) {
            jsonPath = fullPath;
          }
        }
      }
    };

    findFiles(outputDir);

    return {
      markdownPath,
      imagesDir,
      jsonPath,
      outputDir
    };
  }

  async parseLocalFile(filePath, outputDir, onProgress = null) {
    if (!this.isAvailable()) {
      throw new Error('MinerU 服务未启用');
    }

    const { batchId } = await this.createBatchUpload([{ filePath }]);
    const results = await this.waitForBatchCompletion(batchId, onProgress);

    if (results.length === 0) {
      throw new Error('解析失败，无有效结果');
    }

    const { fullZipUrl } = results[0];
    const extracted = await this.downloadAndExtractResults(fullZipUrl, outputDir);

    let markdown = '';
    let contentList = [];
    let images = [];

    if (extracted.markdownPath && fs.existsSync(extracted.markdownPath)) {
      markdown = fs.readFileSync(extracted.markdownPath, 'utf-8');
    }

    if (extracted.jsonPath && fs.existsSync(extracted.jsonPath)) {
      try {
        contentList = JSON.parse(fs.readFileSync(extracted.jsonPath, 'utf-8'));
      } catch (e) {
        console.warn('⚠️  解析 JSON 失败:', e.message);
      }
    }

    if (extracted.imagesDir && fs.existsSync(extracted.imagesDir)) {
      const imageFiles = fs.readdirSync(extracted.imagesDir)
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

      images = imageFiles.map(fileName => {
        const imagePath = path.join(extracted.imagesDir, fileName);
        return {
          fileName,
          path: imagePath,
          ...this._parseImageName(fileName)
        };
      });
    }

    console.log('✅ [MinerU] 解析完成:', {
      markdownLength: markdown.length,
      imageCount: images.length,
      contentListLength: contentList.length
    });

    return {
      markdown,
      images,
      contentList,
      paths: extracted
    };
  }

  _parseImageName(fileName) {
    const match = fileName.match(/(?:img_)?(\d+)_(\d+)\.(jpg|jpeg|png|gif|webp)$/i);
    if (match) {
      return {
        page: parseInt(match[1], 10),
        index: parseInt(match[2], 10)
      };
    }
    return { page: 0, index: 0 };
  }

  extractFiguresFromMarkdown(markdown, images, contentList = null) {
    const figures = [];
    const imageMetaByFile = {};

    if (Array.isArray(contentList)) {
      let lastFigureLabel = null;
      let lastFigurePage = null;
      let lastFigureBBox = null;

      for (const item of contentList) {
        if (!item || item.type !== 'image' || !item.img_path) continue;

        const fileName = path.basename(item.img_path);
        const page = typeof item.page_idx === 'number' ? item.page_idx : 0;

        let captionText = '';
        if (Array.isArray(item.image_caption) && item.image_caption.length > 0) {
          captionText = item.image_caption.join(' ');
        }

        let figureLabel = null;

        if (captionText) {
          const m = captionText.match(/(?:Fig(?:ure)?\.?|图)\s*([0-9]+[A-Za-z]?)/i);
          if (m && m[1]) {
            const figId = String(m[1]).trim();
            figureLabel = `Figure ${figId}`;
          }
        }

        if (!figureLabel && lastFigureLabel && lastFigurePage === page && Array.isArray(item.bbox) && Array.isArray(lastFigureBBox)) {
          const [, y1Prev,, y2Prev] = lastFigureBBox;
          const [, y1,, y2] = item.bbox;
          const overlap = Math.min(y2Prev, y2) - Math.max(y1Prev, y1);
          const heightPrev = Math.max(1, y2Prev - y1Prev);
          if (overlap / heightPrev > 0.3) {
            figureLabel = lastFigureLabel;
          }
        }

        if (figureLabel) {
          lastFigureLabel = figureLabel;
          lastFigurePage = page;
          lastFigureBBox = Array.isArray(item.bbox) ? item.bbox : null;
        }

        imageMetaByFile[fileName] = {
          figureLabel: figureLabel || null,
          caption: captionText || '',
          page
        };
      }
    }

    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    let figureIndex = 1;

    while ((match = imgRegex.exec(markdown)) !== null) {
      const caption = match[1] || '';
      const imgPath = match[2];

      const imgFileName = path.basename(imgPath);
      const localImage = images.find(img =>
        img.fileName === imgFileName ||
        imgPath.includes(img.fileName)
      );

      const mappedMeta = imageMetaByFile[imgFileName];

      let label;
      let finalCaption;

      if (mappedMeta && mappedMeta.figureLabel) {
        label = mappedMeta.figureLabel;
        finalCaption = caption || mappedMeta.caption || mappedMeta.figureLabel;
      } else {
        const figLabelMatch =
          caption.match(/(?:Figure|Fig\.?|图)\s*([0-9]+[A-Za-z]?)/i) ||
          markdown
            .substring(Math.max(0, match.index - 100), match.index)
            .match(/(?:Figure|Fig\.?|图)\s*([0-9]+[A-Za-z]?)/i);

        if (figLabelMatch && figLabelMatch[1]) {
          const figId = String(figLabelMatch[1]).trim();
          label = `Figure ${figId}`;
        } else {
          label = `Figure ${figureIndex}`;
        }

        finalCaption = caption || label;
      }

      figures.push({
        label,
        caption: finalCaption,
        imagePath: localImage?.path || imgPath,
        fileName: imgFileName,
        markdownRef: match[0],
        position: match.index
      });

      figureIndex++;
    }

    figures.sort((a, b) => a.position - b.position);

    return figures;
  }

  async imageToBase64(imagePath, maxSize = 1024) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片不存在: ${imagePath}`);
    }

    const sharp = require('sharp');

    const buffer = await sharp(imagePath)
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  }

  async buildMultimodalContent(textContent, figures, options = {}) {
    const maxImages = options.maxImages || 8;
    const maxImageSize = options.maxImageSize || 1024;

    const content = [];

    content.push({
      type: 'text',
      text: textContent
    });

    const selectedFigures = figures.slice(0, maxImages);

    for (const fig of selectedFigures) {
      if (!fig.imagePath || !fs.existsSync(fig.imagePath)) {
        continue;
      }

      try {
        content.push({
          type: 'text',
          text: `\n\n=== ${fig.label}: ${fig.caption || ''} ===`
        });

        const base64 = await this.imageToBase64(fig.imagePath, maxImageSize);
        content.push({
          type: 'image_url',
          image_url: { url: base64 }
        });
      } catch (error) {
        console.warn(`⚠️  处理图片失败: ${fig.label}`, error.message);
      }
    }

    return content;
  }
}

// Export singleton
const mineruService = new MinerUService();

module.exports = {
  mineruService,
  MinerUService,
  MINERU_CONFIG
};
