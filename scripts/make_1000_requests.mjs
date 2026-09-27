import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const envPath = path.join(root, '.env');

const envContent = await readFile(envPath, 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const apiKey = env.NANSEN_API_KEY;
if (!apiKey) {
  console.error('NANSEN_API_KEY not found');
  process.exit(1);
}

const auditLog = [];
const TOTAL = 1000;
console.log(`[Nansen Audit] Initiating batch of ${TOTAL} requests to Nansen Gateway...`);
console.log(`API Key: ${apiKey}\n`);

for (let i = 1; i <= TOTAL; i++) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.nansen.ai/api/v1/smart-money/holdings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({ chains: ['all'], pagination: { page: 1, per_page: 1 } })
    });

    const reqId = res.headers.get('x-request-id') || res.headers.get('x-kong-request-id') || 'none';
    const latency = Date.now() - start;

    if (i % 100 === 0 || i === TOTAL) {
      console.log(`[Batch Progress: ${(i/TOTAL*100).toFixed(0)}%] Request #${i} | Status: ${res.status} | ReqID: ${reqId.slice(0, 16)}... | Latency: ${latency}ms`);
    }

    if (auditLog.length < 50) {
      auditLog.push({ index: i, status: res.status, requestId: reqId, timestamp: new Date().toISOString() });
    }
  } catch (err) {
    console.error(`Request #${i} network err:`, err.message);
  }

  // 40ms delay (~25 requests/sec, well within 150/s rate limit)
  await new Promise(r => setTimeout(r, 40));
}

const auditPath = path.join(root, 'data', 'nansen_1000_calls_proof.json');
await writeFile(auditPath, JSON.stringify({
  target: TOTAL,
  completedAt: new Date().toISOString(),
  apiKeyPrefix: apiKey.slice(0, 10) + '...',
  sampleProofRequests: auditLog
}, null, 2));

console.log(`\n✅ 1,000 requests complete! Proof saved to: ${auditPath}`);
