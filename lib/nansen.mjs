const API_BASE = 'https://api.nansen.ai/api/v1/smart-money';

const cache = new Map();

async function nansenRequest(apiKey, endpoint, body) {
  const url = `${API_BASE}/${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Nansen API ${endpoint} failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  return response.json();
}

export async function getSmartMoneyNetflow(apiKey, options = {}) {
  const chains = options.chains || ['all'];
  const perPage = options.limit || 80;
  const cacheKey = `netflow:${chains.join(',')}:${perPage}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < (options.ttl || 60000)) {
    return cached.data;
  }

  try {
    const res = await nansenRequest(apiKey, 'netflow', {
      chains,
      filters: {
        include_stablecoins: true,
        include_native_tokens: true
      },
      order_by: [{ field: 'net_flow_24h_usd', direction: 'DESC' }],
      pagination: { page: 1, per_page: perPage }
    });
    const data = res.data || [];
    cache.set(cacheKey, { time: Date.now(), data });
    return data;
  } catch (err) {
    console.error('getSmartMoneyNetflow error:', err.message);
    if (cached) return cached.data;
    throw err;
  }
}

export async function getSmartMoneyHoldings(apiKey, options = {}) {
  const chains = options.chains || ['all'];
  const perPage = options.limit || 80;
  const cacheKey = `holdings:${chains.join(',')}:${perPage}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < (options.ttl || 60000)) {
    return cached.data;
  }

  try {
    const res = await nansenRequest(apiKey, 'holdings', {
      chains,
      order_by: [{ field: 'value_usd', direction: 'DESC' }],
      pagination: { page: 1, per_page: perPage }
    });
    const data = res.data || [];
    cache.set(cacheKey, { time: Date.now(), data });
    return data;
  } catch (err) {
    console.error('getSmartMoneyHoldings error:', err.message);
    if (cached) return cached.data;
    throw err;
  }
}

export async function getSmartMoneyDexTrades(apiKey, options = {}) {
  const chains = options.chains || ['all'];
  const minUsd = options.minUsd || 1000;
  const perPage = options.limit || 60;
  const cacheKey = `dex:${chains.join(',')}:${minUsd}:${perPage}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < (options.ttl || 30000)) {
    return cached.data;
  }

  try {
    const res = await nansenRequest(apiKey, 'dex-trades', {
      chains,
      filters: {
        trade_value_usd: { min: minUsd }
      },
      order_by: [{ field: 'trade_value_usd', direction: 'DESC' }],
      pagination: { page: 1, per_page: perPage }
    });
    const data = res.data || [];
    cache.set(cacheKey, { time: Date.now(), data });
    return data;
  } catch (err) {
    console.error('getSmartMoneyDexTrades error:', err.message);
    if (cached) return cached.data;
    throw err;
  }
}
