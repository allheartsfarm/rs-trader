# Algorithm Methodology & Design

This document describes how trading signals are generated, how strategy weights work, and what makes this system distinctive from a quantitative and institutional perspective.

---

## 1. Multi-Strategy Ensemble

The bot does **not** rely on a single indicator. It runs **six independent strategies** in parallel and combines their outputs into one signal per item.

### 1.1 Strategy roster (default weights)

| Strategy | Weight | Max confidence | Role |
|----------|--------|----------------|------|
| **Mean reversion** | 1.2 | 0.85 | Anchor. Many GE items have stable floors; deviations tend to revert. Highest weight. |
| **Volume** | 1.15 | 0.9 | Filter for “real” moves vs noise. High weight to emphasize volume-confirmed signals. |
| **Support/resistance** | 1.1 | 0.85 | Range-bound behavior; levels matter for entries/exits. |
| **RSI** | 1.0 | 0.9 | Timing: overbought/oversold. Neutral weight. |
| **Momentum** | 0.9 | 0.9 | Trends; less dominant than mean reversion in this market. |
| **Moving average** | 0.8 | 0.75 | Confirmation only; lowest weight and lowest max confidence. |

Weights are **tunable** in `settings.json` per strategy (see [SETTINGS.md](./SETTINGS.md)).

### 1.2 How weighting works

1. **Per-strategy output**  
   Each strategy returns: `action` (BUY/SELL/HOLD), `confidence` (0–1 scale internal to that strategy), and optionally `entryPrice` / `exitPrice`.

2. **Normalization**  
   Raw confidence is normalized by that strategy’s **maxConfidence** so every strategy is on a comparable 0–1 scale:
   - `normalized = min(1, raw_confidence / maxConfidence)`  
   This prevents a single strategy with a high raw scale from dominating.

3. **Weighted average (BUY or SELL only)**  
   When aggregating BUY (or SELL) signals:
   - `weightedSum = Σ (normalized_i × weight_i)`
   - `totalWeight = Σ weight_i`
   - `ensemble_confidence = weightedSum / totalWeight`, capped at **0.95**.

4. **Consensus bonus**  
   If **more than one** strategy agrees (e.g. two or more BUY), the ensemble confidence gets a **+0.1** boost (capped at 0.95). Multiple independent signals agreeing is treated as higher conviction.

5. **Final action**  
   If any strategy says BUY → aggregate as BUY (with the computed confidence and averaged entry/exit from BUY strategies). Else if any says SELL → aggregate as SELL. Else → HOLD with a weak confidence from the strongest single strategy.

So: **higher weight = more influence on the combined confidence**, and **maxConfidence** keeps no strategy from overwhelming the ensemble by scale alone.

---

## 2. What Is Unique in This Codebase

These are design choices and features that go beyond “run a few indicators and pick a side.”

### 2.1 Volume feasibility (capacity constraint)

- **Before** computing position size, the bot estimates whether the trade can be **executed in time** (within `maxTradeDurationDays`).
- Uses **average daily volume** (from the same Wiki API) and a **conservative volume usage** (e.g. 75% of available volume over the window for 2-day trades, higher for longer windows).
- **Volume feasibility** = min(1, available_volume / required_volume). This is passed into the signal path and used to **cap quantity** so recommendations are **actually executable** in the GE’s liquidity—no “theoretical only” size.

### 2.2 Execution plan (market impact & execution risk)

- **ExecutionPlan** (see `src/algorithms/ExecutionPlan.js`) turns a recommended quantity into a **time-based execution plan**:
  - **Buy/sell days**: how many days to spread the buy (and sell) given a cap on **daily volume usage** (e.g. up to 30–50% of average daily volume per day).
  - **Hold days**: implied hold between completing the buy and starting the sell.
  - **Execution risk**: low / medium / high based on share of daily and total volume used.
  - **Slippage**: simple model (e.g. 0.1–0.5% per 10% of daily volume) for display and future use.

So every recommendation comes with an **explicit execution narrative** and risk label, not just “buy X at Y.”

### 2.3 Realism layer (exit price and profit caps)

- **Historical cap**: Exit price cannot exceed **historical high** by more than a configured margin (e.g. 10%; stricter, e.g. 5%, for very high-profit targets). This avoids “pie in the sky” targets that the market has never printed.
- **Profit margin caps**: Max profit % per trade is capped (e.g. 20% for 2-day trades) so targets stay in a realistic band.
- **GE fee-aware P&L**: All profit and exit calculations use **2% GE fee** for items &gt; 50 gp (buy and sell). Net profit and required exit are computed **after fees** so displayed profits are what the player actually keeps.
- **Quantity**: Derived from capital, position size %, and **volume feasibility** so size is both capital- and liquidity-constrained.

### 2.4 Profit-per-month percentile filter

- Recommendations are scored by **profit per month** (net profit × 30 / trade_duration) and optionally by confidence.
- Only the **top fraction** (e.g. top **20%** by profit per month) of BUY recommendations are shown (`profitPerMonthPercentile`). There is also a **minimum profit per month** floor (`minProfitPerMonth`).
- So the bot focuses on **throughput and capital efficiency**, not just “any positive edge”—closer to a **capital allocation** view (best risk/return per slot).

### 2.5 Incremental, backtest-ready data

- Historical data is collected **incrementally** and **append-only** (see [BACKTESTING.md](./BACKTESTING.md)): new days are merged, deduplicated by date, with a configurable max window (e.g. 365 days).
- This supports **future backtesting** on a growing history without re-fetching everything each time—aligned with how systematic shops treat time series.

### 2.6 F2P-aware position and sizing

- **Max 3 positions** (configurable) and **position size %** (e.g. 33% of capital per position) enforce the in-game F2P limit and avoid over-concentration.
- All of the above (volume feasibility, execution plan, fee-aware P&L, percentile filter) work within these constraints so the system is **deployable** for the target use case, not just theoretical.

---

## 3. Why This Is “Hedge-Fund Style” (Conceptually)

- **Ensemble with explicit weights and caps**: Multiple uncorrelated signals, normalized and weighted, with a consensus bonus—similar in spirit to multi-factor or multi-strategy allocation.
- **Execution and capacity**: Explicit **execution plan**, **volume feasibility**, and **execution risk**—analogous to market impact and execution risk in institutional trading.
- **Fee-aware, net P&L**: All targets and displays are **after costs** (GE fees), like trading desks optimizing for net P&L.
- **Capital efficiency**: **Profit-per-month percentile** and **min profit per month** focus on best use of limited slots (capital), not just raw edge.
- **Realism and backtestability**: **Historical caps** and **incremental history** reduce overfitting to impossible exits and set the stage for out-of-sample backtests.

The implementation is tailored to a single game economy (OSRS GE) and F2P limits, but the **methodology**—weighted ensemble, execution and capacity constraints, fee-aware net P&L, and percentile-based capital allocation—is the kind of structure a quant or risk-conscious team would expect to see in a serious signal and execution framework.

---

## 4. References in code

- **Ensemble aggregation**: `SignalGenerator.aggregateSignals()` in `src/algorithms/SignalGenerator.js`
- **Strategy config (weights, maxConfidence)**: `src/config/Settings.js` and `settings.json`
- **Volume feasibility**: `SignalGenerator.generateSignal()` (volumeFeasibility, quantity capping)
- **Execution plan**: `ExecutionPlan.calculateExecutionPlan()` in `src/algorithms/ExecutionPlan.js`
- **Profit-per-month filtering**: `TradingBot` (e.g. percentile filter, scoring by profit per month)
- **GE fees**: `src/utils/GEFee.js` (calculateNetProfit, adjustExitPriceForFees in SignalGenerator)
- **Realism caps**: `SignalGenerator.generateSignal()` (historical max cap, profit margin caps)
