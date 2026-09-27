# 🌐 Nansen FlowMatrix — Smart Money Signal Engine

> **Submissions for Nansen Meridian Buildathon ($10,000 USDC)**  
> **Tagline:** Turning Nansen Smart Money Intelligence into Actionable Spot, Long & Short Execution Signals.

---

## ⚡ What is Nansen FlowMatrix?

Most crypto dashboards only show charts and historical balances. **Nansen FlowMatrix is an algorithmic signal engine where on-chain data directly drives trading decisions**:
1. **🟢 Spot Accumulation Ignition (DCA Start):** Detects silent Smart Money accumulation in consolidation zones before price expansions.
2. **🚀 Momentum Long Scanner:** Spots explosive DEX market buying pressure ($Buy/Sell > 2.5x) and 1H inflow acceleration for high-conviction breakout trades.
3. **🔴 Distribution Short Alerts:** Identifies tokens where Smart Money is dumping into retail FOMO, allowing traders to enter high-probability shorts or avoid buying exit liquidity.
4. **⚡ Real-Time Smart Money DEX Tape:** Live multi-chain stream of swaps executed by verified funds and top-performing wallets.

---

## 🎯 How Nansen Data Drives the Logic

- **Smart Money Netflow (`/api/v1/smart-money/netflow`):** Evaluates multi-timeframe flow velocity (1h, 24h, 7d, 30d) across Solana, Ethereum, Base, and Arbitrum.
- **Smart Money Holdings (`/api/v1/smart-money/holdings`):** Tracks wallet concentration, 24h balance percentage changes, and total fund value.
- **Smart Money DEX Trades (`/api/v1/smart-money/dex-trades`):** Calculates real-time buy/sell volume pressure ratios and flags multi-wallet coordinated front-running.

Each token receives a **Composite Alpha Score (0–100)** with pre-calculated trade blueprints:
- **Action Type** (Market Buy, Pullback Retest, Limit DCA, Breakdown Short)
- **Stop Loss / Invalidation Level**
- **Take Profit Targets (TP1, TP2, TP3)**
- **Risk/Reward Ratio**

---

## 🚀 Quick Start (< 2 Minutes)

### 1. Clone & Configure
```bash
git clone https://github.com/your-username/nansen-flowmatrix.git
cd nansen-flowmatrix
cp .env.example .env
```

Set your Nansen API key in `.env`:
```env
PORT=8090
HOST=0.0.0.0
NANSEN_API_KEY=your_nansen_api_key_here
```

### 2. Run
```bash
node server.mjs
```

Open your browser at:
`https://nansen.gogettest.online/` (or `http://localhost:8090`)

---

## 📡 API Endpoints

- `GET /api/signals`: Returns categorized Spot, Long, and Short signals with quantitative scores and trade plans.
- `GET /api/dex-trades`: Live stream of high-value DEX swaps from Smart Money.
- `GET /api/health`: Service health, uptime, and Nansen API latency.

---

## 🏆 Meridian Buildathon Criteria Alignment

- **Data Integration (25%):** Nansen data is the direct engine of execution plans, entry triggers, stop-losses, and scores.
- **Creativity & Originality (25%):** Bridges the gap between raw on-chain data and actual trading execution (Spot DCA, Long Squeeze, Short Dump).
- **Functionality & Workability (25%):** Fully functional, live server with zero external database dependencies and sub-50ms local response caching.
- **Documentation & Submission (25%):** One-command startup, clean architecture, self-contained ESM stack.
