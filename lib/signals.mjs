export function buildSignals(netflowRows = [], holdingsRows = [], dexTrades = []) {
  const tokenMap = new Map();

  function getOrCreateToken(chain, symbol, address) {
    const normChain = (chain || 'ethereum').toLowerCase();
    const normSymbol = (symbol || 'UNKNOWN').toUpperCase();
    const key = `${normChain}:${address || normSymbol}`;

    if (!tokenMap.has(key)) {
      tokenMap.set(key, {
        key,
        chain: normChain,
        symbol: normSymbol,
        address: address || null,
        sectors: [],
        marketCapUsd: 0,
        // Netflow metrics
        netflow1h: 0,
        netflow24h: 0,
        netflow7d: 0,
        netflow30d: 0,
        traderCount: 0,
        tokenAgeDays: 0,
        // Holdings metrics
        holdingsValueUsd: 0,
        balance24hPctChange: 0,
        holdersCount: 0,
        shareOfHoldingsPct: 0,
        // DEX trades metrics
        dexBuyVolUsd: 0,
        dexSellVolUsd: 0,
        dexBuyCount: 0,
        dexSellCount: 0,
        dexBuyers: new Set(),
        dexSellers: new Set(),
        recentTrades: []
      });
    }
    return tokenMap.get(key);
  }

  // 1. Process Netflow
  for (const row of netflowRows) {
    if (!row.token_symbol) continue;
    const token = getOrCreateToken(row.chain, row.token_symbol, row.token_address);
    token.netflow1h = Number(row.net_flow_1h_usd) || 0;
    token.netflow24h = Number(row.net_flow_24h_usd) || 0;
    token.netflow7d = Number(row.net_flow_7d_usd) || 0;
    token.netflow30d = Number(row.net_flow_30d_usd) || 0;
    token.traderCount = Math.max(token.traderCount, Number(row.trader_count) || 0);
    token.tokenAgeDays = Number(row.token_age_days) || token.tokenAgeDays;
    token.marketCapUsd = Number(row.market_cap_usd) || token.marketCapUsd;
    if (Array.isArray(row.token_sectors)) token.sectors = row.token_sectors;
  }

  // 2. Process Holdings
  for (const row of holdingsRows) {
    if (!row.token_symbol) continue;
    const token = getOrCreateToken(row.chain, row.token_symbol, row.token_address);
    token.holdingsValueUsd = Math.max(token.holdingsValueUsd, Number(row.value_usd) || 0);
    token.balance24hPctChange = Number(row.balance_24h_percent_change) || token.balance24hPctChange;
    token.holdersCount = Math.max(token.holdersCount, Number(row.holders_count) || 0);
    token.shareOfHoldingsPct = Number(row.share_of_holdings_percent) || token.shareOfHoldingsPct;
    token.marketCapUsd = Number(row.market_cap_usd) || token.marketCapUsd;
    if (Array.isArray(row.token_sectors) && token.sectors.length === 0) token.sectors = row.token_sectors;
  }

  // 3. Process DEX Trades
  for (const trade of dexTrades) {
    const val = Number(trade.trade_value_usd) || 0;
    const trader = trade.trader_address || 'unknown';

    if (trade.token_bought_symbol) {
      const bToken = getOrCreateToken(trade.chain, trade.token_bought_symbol, trade.token_bought_address);
      bToken.dexBuyVolUsd += val;
      bToken.dexBuyCount += 1;
      bToken.dexBuyers.add(trader);
      if (bToken.recentTrades.length < 5) {
        bToken.recentTrades.push({
          type: 'BUY',
          valueUsd: val,
          traderLabel: trade.trader_address_label || 'Smart Wallet',
          timestamp: trade.block_timestamp
        });
      }
    }

    if (trade.token_sold_symbol) {
      const sToken = getOrCreateToken(trade.chain, trade.token_sold_symbol, trade.token_sold_address);
      sToken.dexSellVolUsd += val;
      sToken.dexSellCount += 1;
      sToken.dexSellers.add(trader);
      if (sToken.recentTrades.length < 5) {
        sToken.recentTrades.push({
          type: 'SELL',
          valueUsd: val,
          traderLabel: trade.trader_address_label || 'Smart Wallet',
          timestamp: trade.block_timestamp
        });
      }
    }
  }

  // 4. Calculate Scores and Categorize
  const spotRadar = [];
  const longRadar = [];
  const shortRadar = [];

  for (const token of tokenMap.values()) {
    // Ignore pure stablecoins from trading triggers
    const isStable = ['USDT', 'USDC', 'DAI', 'USDG', 'FDUSD', 'TUSD', 'PYUSD'].includes(token.symbol);
    if (isStable) continue;

    // --- SPOT ACCUMULATION SCORING ---
    let spotScore = 0;
    if (token.netflow7d > 100000) spotScore += 25;
    else if (token.netflow7d > 20000) spotScore += 15;
    else if (token.netflow7d > 0) spotScore += 8;

    if (token.netflow24h > 25000) spotScore += 20;
    else if (token.netflow24h > 5000) spotScore += 10;

    if (token.balance24hPctChange > 0.01) spotScore += 20;
    else if (token.balance24hPctChange > 0) spotScore += 10;

    if (token.holdersCount >= 20) spotScore += 15;
    else if (token.holdersCount >= 5) spotScore += 8;

    if (token.traderCount >= 20) spotScore += 10;
    else if (token.traderCount >= 5) spotScore += 5;

    if (token.holdingsValueUsd > 1000000) spotScore += 10;

    spotScore = Math.min(99, Math.max(10, spotScore));

    // --- MOMENTUM LONG SCORING ---
    let longScore = 0;
    const totalDexVol = token.dexBuyVolUsd + token.dexSellVolUsd;
    const buyRatio = totalDexVol > 0 ? token.dexBuyVolUsd / totalDexVol : 0.5;

    if (buyRatio >= 0.8 && token.dexBuyVolUsd > 10000) longScore += 35;
    else if (buyRatio >= 0.65) longScore += 20;
    else if (buyRatio >= 0.5) longScore += 10;

    if (token.netflow1h > 15000) longScore += 25;
    else if (token.netflow1h > 2000) longScore += 15;
    else if (token.netflow1h > 0) longScore += 8;

    if (token.dexBuyers.size >= 3) longScore += 20;
    else if (token.dexBuyers.size >= 1) longScore += 10;

    if (token.netflow24h > 50000) longScore += 20;
    else if (token.netflow24h > 0) longScore += 10;

    longScore = Math.min(99, Math.max(10, longScore));

    // --- DISTRIBUTION SHORT SCORING ---
    let shortScore = 0;
    if (token.netflow24h < -100000) shortScore += 35;
    else if (token.netflow24h < -25000) shortScore += 20;
    else if (token.netflow24h < 0) shortScore += 10;

    if (token.netflow1h < -20000) shortScore += 25;
    else if (token.netflow1h < -3000) shortScore += 15;

    if (buyRatio <= 0.25 && token.dexSellVolUsd > 10000) shortScore += 25;
    else if (buyRatio <= 0.4) shortScore += 15;

    if (token.balance24hPctChange < -0.01) shortScore += 15;
    if (token.dexSellers.size >= 3) shortScore += 15;

    shortScore = Math.min(99, Math.max(10, shortScore));

    // Formatting Token Output
    const basePayload = {
      chain: token.chain,
      symbol: token.symbol,
      address: token.address,
      sectors: token.sectors,
      marketCapUsd: token.marketCapUsd,
      netflow1h: token.netflow1h,
      netflow24h: token.netflow24h,
      netflow7d: token.netflow7d,
      holdingsValueUsd: token.holdingsValueUsd,
      balance24hPctChange: token.balance24hPctChange,
      holdersCount: token.holdersCount,
      traderCount: token.traderCount,
      dexBuyVolUsd: token.dexBuyVolUsd,
      dexSellVolUsd: token.dexSellVolUsd,
      recentTrades: token.recentTrades
    };

    // Spot candidate
    if (spotScore >= 50 || token.netflow7d > 20000) {
      spotRadar.push({
        ...basePayload,
        score: spotScore,
        signalType: 'SPOT_ACCUMULATION',
        status: spotScore >= 75 ? 'CONFIRMED_ACCUMULATION' : 'EARLY_ACCUMULATION',
        plan: {
          action: 'START_DCA_LADDER',
          recommendedAllocation: spotScore >= 80 ? '30% First Tranche + 70% Limit Grid' : '15% Test Tranche',
          invalidation: 'Smart Money 7D Netflow flips negative (< 0)',
          targets: ['+25% First Expansion', '+65% Major Swing', '+140% Macro Run'],
          thesis: `Smart Money holds $${(token.holdingsValueUsd/1000).toFixed(0)}k with $${(token.netflow7d/1000).toFixed(1)}k net inflows over 7 days across ${token.holdersCount || token.traderCount} smart entities.`
        }
      });
    }

    // Long candidate
    if (longScore >= 50 || (buyRatio >= 0.7 && token.dexBuyVolUsd > 5000)) {
      longRadar.push({
        ...basePayload,
        score: longScore,
        signalType: 'MOMENTUM_LONG',
        status: longScore >= 75 ? 'HIGH_CONVICTION_BREAKOUT' : 'MOMENTUM_WATCH',
        plan: {
          action: 'LONG_MARKET_OR_PULLBACK',
          entryType: 'Market Buy on 15m VWAP Retest',
          stopLoss: 'Tight Stop Loss 2.2% - 3.2% below SM average entry',
          targets: ['+8.5% Scalp TP1', '+18.0% Runner TP2', '+32.0% Extended Squeeze'],
          riskReward: '1:3.6',
          thesis: `DEX Smart Money buy pressure is at ${(buyRatio*100).toFixed(0)}% ($${(token.dexBuyVolUsd/1000).toFixed(1)}k buys vs $${(token.dexSellVolUsd/1000).toFixed(1)}k sells). Inflows accelerating in 1h window.`
        }
      });
    }

    // Short candidate
    if (shortScore >= 50 || (token.netflow24h < -20000)) {
      shortRadar.push({
        ...basePayload,
        score: shortScore,
        signalType: 'DISTRIBUTION_SHORT',
        status: shortScore >= 75 ? 'IMMINENT_DUMP_WARNING' : 'DISTRIBUTION_BUILDING',
        plan: {
          action: 'ENTER_SHORT_ON_BREAKDOWN',
          entryType: 'Limit Short on pump exhaustion / breakdown of local support',
          stopLoss: 'Invalidation above 24h swing high (+2.8%)',
          targets: ['-9.0% Liquidity sweep TP1', '-22.0% Deep Support TP2', '-45.0% Capitulation'],
          riskReward: '1:4.1',
          thesis: `Smart Money is unloading: -$${Math.abs(token.netflow24h/1000).toFixed(1)}k net outflow in 24h. Retail is buying exit liquidity while funds exit.`
        }
      });
    }
  }

  // Sort descending by score
  spotRadar.sort((a, b) => b.score - a.score);
  longRadar.sort((a, b) => b.score - a.score);
  shortRadar.sort((a, b) => b.score - a.score);

  return {
    timestamp: new Date().toISOString(),
    stats: {
      totalTokensTracked: tokenMap.size,
      spotCandidatesCount: spotRadar.length,
      longCandidatesCount: longRadar.length,
      shortCandidatesCount: shortRadar.length,
      totalSmartMoneyNetflow24h: [...tokenMap.values()].reduce((sum, t) => sum + t.netflow24h, 0),
      totalDexVolumeTracked: [...tokenMap.values()].reduce((sum, t) => sum + t.dexBuyVolUsd + t.dexSellVolUsd, 0)
    },
    spotRadar: spotRadar.slice(0, 30),
    longRadar: longRadar.slice(0, 30),
    shortRadar: shortRadar.slice(0, 30)
  };
}
