import { readFile } from 'fs/promises';

const envContent = await readFile('/opt/nansen-flowmatrix/.env', 'utf8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('='))
);

const apiKey = env.NANSEN_API_KEY;

async function test() {
  console.log('Testing Holdings...');
  const hRes = await fetch('https://api.nansen.ai/api/v1/smart-money/holdings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ chains: ['all'], pagination: { page: 1, per_page: 3 } })
  });
  const hData = await hRes.json();
  console.log('Holdings status:', hRes.status, 'items:', hData.data?.length);

  console.log('Testing Netflow...');
  const nRes = await fetch('https://api.nansen.ai/api/v1/smart-money/netflow', {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ chains: ['all'], pagination: { page: 1, per_page: 3 } })
  });
  const nData = await nRes.json();
  console.log('Netflow status:', nRes.status, 'items:', nData.data?.length);

  console.log('Testing Dex Trades...');
  const dRes = await fetch('https://api.nansen.ai/api/v1/smart-money/dex-trades', {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ chains: ['all'], filters: { trade_value_usd: { min: 1000 } }, pagination: { page: 1, per_page: 3 } })
  });
  const dData = await dRes.json();
  console.log('Dex trades status:', dRes.status, 'items:', dData.data?.length);
}

test().catch(console.error);
