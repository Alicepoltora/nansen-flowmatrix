let activeTab = 'spot';
let activeChain = 'all';
let searchQuery = '';
let currentData = null;
let dexTradesData = [];
let refreshTimer = null;
let countdownSec = 30;

// Formatters
function formatUsd(num) {
  if (!num && num !== 0) return '$0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPercent(num) {
  if (!num && num !== 0) return '0%';
  const sign = num > 0 ? '+' : '';
  return `${sign}${(num * 100).toFixed(1)}%`;
}

function timeAgo(dateString) {
  if (!dateString) return 'recently';
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

// Fetch Signals
async function loadSignals(force = false) {
  const startTime = performance.now();
  try {
    const url = `/api/signals${force ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    const latency = Math.round(performance.now() - startTime);
    document.getElementById('kpi-latency').innerText = `${latency}ms`;

    if (!res.ok) throw new Error('API returned ' + res.status);
    currentData = await res.json();

    updateKpis();
    renderActiveTab();
    resetCountdown();
  } catch (err) {
    console.error('Failed to load signals:', err);
    document.getElementById('api-status').innerHTML = '<span class="dot" style="background:#ff3366"></span><span>ERROR</span>';
  }
}

// Fetch Live DEX Tape
async function loadDexTrades() {
  try {
    const res = await fetch('/api/dex-trades');
    if (!res.ok) return;
    const json = await res.json();
    dexTradesData = json.trades || [];
    if (activeTab === 'dex') renderDexTape();
  } catch (err) {
    console.error('Failed to load DEX trades:', err);
  }
}

// Update Top KPIs & Badges
function updateKpis() {
  if (!currentData) return;
  const { stats, spotRadar, longRadar, shortRadar } = currentData;

  document.getElementById('kpi-tokens').innerText = stats.totalTokensTracked || 0;
  document.getElementById('kpi-netflow').innerText = formatUsd(stats.totalSmartMoneyNetflow24h || 0);

  document.getElementById('count-spot').innerText = spotRadar.length;
  document.getElementById('count-long').innerText = longRadar.length;
  document.getElementById('count-short').innerText = shortRadar.length;
}

// Filter items
function filterItems(items = []) {
  return items.filter(item => {
    const matchChain = activeChain === 'all' || item.chain.toLowerCase() === activeChain;
    const matchSearch = !searchQuery || 
      item.symbol.toLowerCase().includes(searchQuery) ||
      (item.address && item.address.toLowerCase().includes(searchQuery));
    return matchChain && matchSearch;
  });
}

// Render active tab
function renderActiveTab() {
  if (activeTab === 'spot') renderSpotGrid();
  else if (activeTab === 'long') renderLongGrid();
  else if (activeTab === 'short') renderShortGrid();
  else if (activeTab === 'dex') renderDexTape();
}

// Render Spot Grid
function renderSpotGrid() {
  const container = document.getElementById('grid-spot');
  if (!currentData || !currentData.spotRadar) return;
  const items = filterItems(currentData.spotRadar);

  if (items.length === 0) {
    container.innerHTML = `<div class="loader-skeleton">No spot accumulation signals matching active filters.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="signal-card type-spot">
      <div class="card-top">
        <div class="token-head">
          <span class="token-symbol">${item.symbol}</span>
          <span class="chain-badge">${item.chain}</span>
        </div>
        <div class="score-badge score-green">
          <span>●</span> ACCUMULATION ${item.score}/100
        </div>
      </div>

      <div class="card-metrics">
        <div class="metric-item">
          <span class="m-label">7D NETFLOW</span>
          <span class="m-value text-green">${formatUsd(item.netflow7d)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">24H NETFLOW</span>
          <span class="m-value ${item.netflow24h >= 0 ? 'text-green' : 'text-red'}">${formatUsd(item.netflow24h)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">SM HOLDERS</span>
          <span class="m-value">${item.holdersCount || item.traderCount || 1} entities</span>
        </div>
      </div>

      <div class="card-plan">
        <div class="plan-row">
          <span class="plan-key">Execution Mode</span>
          <span class="plan-val text-green">${item.plan.action}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Allocation</span>
          <span class="plan-val">${item.plan.recommendedAllocation}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Cycle Target</span>
          <span class="plan-val text-green">${item.plan.targets[1]}</span>
        </div>
      </div>

      <div class="card-thesis">${item.plan.thesis}</div>

      <div class="card-actions">
        <button class="btn-inspect" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Inspect Signal</button>
        <a class="btn-dex" href="https://dexscreener.com/${item.chain}/${item.address || item.symbol}" target="_blank">Chart ↗</a>
      </div>
    </div>
  `).join('');
}

// Render Long Grid
function renderLongGrid() {
  const container = document.getElementById('grid-long');
  if (!currentData || !currentData.longRadar) return;
  const items = filterItems(currentData.longRadar);

  if (items.length === 0) {
    container.innerHTML = `<div class="loader-skeleton">No momentum long signals matching active filters.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="signal-card type-long">
      <div class="card-top">
        <div class="token-head">
          <span class="token-symbol">${item.symbol}</span>
          <span class="chain-badge">${item.chain}</span>
        </div>
        <div class="score-badge score-cyan">
          <span>▲</span> MOMENTUM ${item.score}/100
        </div>
      </div>

      <div class="card-metrics">
        <div class="metric-item">
          <span class="m-label">DEX BUY VOL</span>
          <span class="m-value text-cyan">${formatUsd(item.dexBuyVolUsd)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">1H NETFLOW</span>
          <span class="m-value ${item.netflow1h >= 0 ? 'text-cyan' : 'text-red'}">${formatUsd(item.netflow1h)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">RISK / REWARD</span>
          <span class="m-value text-cyan">${item.plan.riskReward}</span>
        </div>
      </div>

      <div class="card-plan">
        <div class="plan-row">
          <span class="plan-key">Trigger</span>
          <span class="plan-val text-cyan">${item.plan.entryType}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Stop Loss</span>
          <span class="plan-val text-red">${item.plan.stopLoss}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Target 1 & 2</span>
          <span class="plan-val text-cyan">${item.plan.targets[0]}, ${item.plan.targets[1]}</span>
        </div>
      </div>

      <div class="card-thesis">${item.plan.thesis}</div>

      <div class="card-actions">
        <button class="btn-inspect" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Inspect Signal</button>
        <a class="btn-dex" href="https://dexscreener.com/${item.chain}/${item.address || item.symbol}" target="_blank">Chart ↗</a>
      </div>
    </div>
  `).join('');
}

// Render Short Grid
function renderShortGrid() {
  const container = document.getElementById('grid-short');
  if (!currentData || !currentData.shortRadar) return;
  const items = filterItems(currentData.shortRadar);

  if (items.length === 0) {
    container.innerHTML = `<div class="loader-skeleton">No active distribution short alerts matching active filters.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="signal-card type-short">
      <div class="card-top">
        <div class="token-head">
          <span class="token-symbol">${item.symbol}</span>
          <span class="chain-badge">${item.chain}</span>
        </div>
        <div class="score-badge score-red">
          <span>▼</span> DUMP RISK ${item.score}/100
        </div>
      </div>

      <div class="card-metrics">
        <div class="metric-item">
          <span class="m-label">24H NETFLOW</span>
          <span class="m-value text-red">${formatUsd(item.netflow24h)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">DEX SELL VOL</span>
          <span class="m-value text-red">${formatUsd(item.dexSellVolUsd)}</span>
        </div>
        <div class="metric-item">
          <span class="m-label">RISK / REWARD</span>
          <span class="m-value">${item.plan.riskReward}</span>
        </div>
      </div>

      <div class="card-plan">
        <div class="plan-row">
          <span class="plan-key">Trigger</span>
          <span class="plan-val text-red">${item.plan.entryType}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Invalidation</span>
          <span class="plan-val">${item.plan.stopLoss}</span>
        </div>
        <div class="plan-row">
          <span class="plan-key">Targets</span>
          <span class="plan-val text-red">${item.plan.targets[0]}, ${item.plan.targets[1]}</span>
        </div>
      </div>

      <div class="card-thesis">${item.plan.thesis}</div>

      <div class="card-actions">
        <button class="btn-inspect" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&apos;")})'>Inspect Signal</button>
        <a class="btn-dex" href="https://dexscreener.com/${item.chain}/${item.address || item.symbol}" target="_blank">Chart ↗</a>
      </div>
    </div>
  `).join('');
}

// Render DEX Tape
function renderDexTape() {
  const tbody = document.getElementById('dex-tape-body');
  if (dexTradesData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No recent DEX trades recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = dexTradesData.map(t => {
    const isBuy = Boolean(t.token_bought_symbol);
    const tokenSymbol = isBuy ? t.token_bought_symbol : t.token_sold_symbol;
    const actionColor = isBuy ? 'text-green' : 'text-red';
    const actionText = isBuy ? 'BUY' : 'SELL';
    const shortWallet = t.trader_address ? `${t.trader_address.slice(0, 6)}...${t.trader_address.slice(-4)}` : '—';
    const label = t.trader_address_label ? `<span class="tag-live">${t.trader_address_label}</span>` : shortWallet;
    const txLink = t.transaction_hash ? `${t.transaction_hash.slice(0, 8)}...` : 'tx';

    return `
      <tr>
        <td class="text-muted">${timeAgo(t.block_timestamp)}</td>
        <td><span class="chain-badge">${t.chain}</span></td>
        <td class="${actionColor} font-bold">${actionText}</td>
        <td><strong>${tokenSymbol || 'TOKEN'}</strong></td>
        <td class="font-bold">${formatUsd(t.trade_value_usd)}</td>
        <td>${label}</td>
        <td><span class="text-muted">${txLink}</span></td>
      </tr>
    `;
  }).join('');
}

// Modal View
window.openModal = function(item) {
  const modal = document.getElementById('signal-modal');
  document.getElementById('modal-symbol').innerText = item.symbol;
  document.getElementById('modal-chain').innerText = item.chain.toUpperCase();
  document.getElementById('modal-score').innerText = `Confidence Score: ${item.score}/100`;

  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3 style="margin-bottom: 8px; color: #fff;">Quantitative Signal Summary</h3>
      <p style="color: #cbd5e1; font-size: 0.88rem; line-height: 1.5;">${item.plan.thesis}</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div class="kpi-pill">
        <span class="kpi-label">1H NETFLOW</span>
        <span class="kpi-val ${item.netflow1h >= 0 ? 'text-green' : 'text-red'}">${formatUsd(item.netflow1h)}</span>
      </div>
      <div class="kpi-pill">
        <span class="kpi-label">24H NETFLOW</span>
        <span class="kpi-val ${item.netflow24h >= 0 ? 'text-green' : 'text-red'}">${formatUsd(item.netflow24h)}</span>
      </div>
      <div class="kpi-pill">
        <span class="kpi-label">7D NETFLOW</span>
        <span class="kpi-val ${item.netflow7d >= 0 ? 'text-green' : 'text-red'}">${formatUsd(item.netflow7d)}</span>
      </div>
      <div class="kpi-pill">
        <span class="kpi-label">TOTAL SM HOLDINGS</span>
        <span class="kpi-val">${formatUsd(item.holdingsValueUsd)}</span>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); padding: 18px; border-radius: 10px; margin-bottom: 20px;">
      <h4 style="margin-bottom: 12px; color: var(--green);">Algorithmic Trade Blueprint</h4>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem;">
        <div><strong>Action:</strong> <span class="text-green">${item.plan.action || item.plan.entryType}</span></div>
        <div><strong>Stop / Invalidation:</strong> <span class="text-red">${item.plan.stopLoss || item.plan.invalidation}</span></div>
        <div><strong>Targets:</strong> <span>${item.plan.targets.join(' → ')}</span></div>
        ${item.plan.riskReward ? `<div><strong>Calculated R:R:</strong> <span class="text-cyan">${item.plan.riskReward}</span></div>` : ''}
      </div>
    </div>

    <div style="display: flex; gap: 12px;">
      <a href="https://dexscreener.com/${item.chain}/${item.address || item.symbol}" target="_blank" class="btn-inspect" style="text-align: center; text-decoration: none;">Open on DexScreener ↗</a>
      ${item.address ? `<button class="btn-inspect" onclick="navigator.clipboard.writeText('${item.address}'); alert('Address copied!');">Copy Contract</button>` : ''}
    </div>
  `;

  modal.style.display = 'flex';
};

document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('signal-modal').style.display = 'none';
});

// Event Listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.getElementById(`section-${activeTab}`).classList.add('active');
    renderActiveTab();
  });
});

document.querySelectorAll('.chain-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.chain-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeChain = pill.dataset.chain;
    renderActiveTab();
  });
});

document.getElementById('token-search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderActiveTab();
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  loadSignals(true);
  loadDexTrades();
});

function resetCountdown() {
  countdownSec = 30;
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    countdownSec -= 1;
    if (countdownSec <= 0) {
      loadSignals();
      loadDexTrades();
    } else {
      document.getElementById('refresh-countdown').innerText = `Sync in ${countdownSec}s`;
    }
  }, 1000);
}

// Initial Boot
loadSignals();
loadDexTrades();
