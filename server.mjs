import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSmartMoneyNetflow, getSmartMoneyHoldings, getSmartMoneyDexTrades } from './lib/nansen.mjs';
import { buildSignals } from './lib/signals.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = path.dirname(__filename);
const publicDir = path.join(root, 'public');

// Simple .env parser
async function loadEnv() {
  const envFile = path.join(root, '.env');
  if (!existsSync(envFile)) return;
  const content = await readFile(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

await loadEnv();

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '0.0.0.0';
const NANSEN_API_KEY = process.env.NANSEN_API_KEY?.trim() || '';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': MIME_TYPES['.json'],
    'access-control-allow-origin': '*',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

let cachedSignals = null;
let lastSignalsFetchTime = 0;
const SIGNALS_CACHE_TTL = 30000; // 30s cache

async function fetchAllSignals(force = false) {
  const now = Date.now();
  if (!force && cachedSignals && (now - lastSignalsFetchTime < SIGNALS_CACHE_TTL)) {
    return cachedSignals;
  }

  if (!NANSEN_API_KEY) {
    throw new Error('NANSEN_API_KEY is not configured in .env');
  }

  const [netflow, holdings, dexTrades] = await Promise.all([
    getSmartMoneyNetflow(NANSEN_API_KEY, { limit: 80 }),
    getSmartMoneyHoldings(NANSEN_API_KEY, { limit: 80 }),
    getSmartMoneyDexTrades(NANSEN_API_KEY, { limit: 60 })
  ]);

  cachedSignals = buildSignals(netflow, holdings, dexTrades);
  lastSignalsFetchTime = now;
  return cachedSignals;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // CORS headers
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    return res.end();
  }

  // Health
  if (url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'nansen-flowmatrix',
      uptimeSec: Math.round(process.uptime()),
      hasApiKey: Boolean(NANSEN_API_KEY),
      timestamp: new Date().toISOString()
    });
  }

  // Signals API
  if (url.pathname === '/api/signals') {
    try {
      const force = url.searchParams.get('refresh') === 'true';
      const data = await fetchAllSignals(force);
      return sendJson(res, 200, data);
    } catch (err) {
      console.error('Error generating signals:', err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Live DEX Trades API
  if (url.pathname === '/api/dex-trades') {
    try {
      const trades = await getSmartMoneyDexTrades(NANSEN_API_KEY, { limit: 50 });
      return sendJson(res, 200, { trades });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Static File Serving
  let filePath = path.join(publicDir, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
    return;
  }

  // Default SPA fallback to index.html
  const fallbackPath = path.join(publicDir, 'index.html');
  if (existsSync(fallbackPath)) {
    res.writeHead(200, { 'content-type': MIME_TYPES['.html'] });
    createReadStream(fallbackPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[Nansen FlowMatrix] Engine online at http://${HOST}:${PORT}`);
});
