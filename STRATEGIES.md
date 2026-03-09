# Trading Strategies

This document describes all available trading strategies and the historical data they use.

## Available Historical Data

The bot fetches data from the RuneScape Wiki API (`https://prices.runescape.wiki/api/v1/osrs`):

- **Price Data**: `avgHighPrice`, `avgLowPrice` (we use average)
- **Volume Data**: Trading volume per day
- **Timestamp**: Unix timestamp for each data point
- **Time Range**: Up to 30+ days of historical data

## Current Strategies (6 Total)

### 1. Momentum Strategy
**What it does**: Identifies trends by comparing recent average prices to older averages.

**Data used**: 
- Recent 5-day average vs older 5-day average
- Current price change

**Best for**: Trending markets, catching momentum early

**Config**: `strategies.momentum`
- `lookbackPeriod`: Days to compare (default: 5)
- `profitCap`: Maximum profit target (default: 12%)

---

### 2. Mean Reversion Strategy
**What it does**: Finds when prices deviate significantly from the mean and expects them to revert.

**Data used**:
- 20-day moving average
- Standard deviation (z-score)
- Current price vs mean

**Best for**: Range-bound markets, items with stable prices

**Config**: `strategies.meanReversion`
- `lookbackPeriod`: Days for mean calculation (default: 20)
- `deviationThreshold`: Deviation % to trigger (default: 10%)
- `profitCap`: Maximum profit target (default: 15%)

---

### 3. Volume Strategy
**What it does**: Analyzes trading volume spikes to identify significant price moves.

**Data used**:
- Recent volume vs average volume
- Price change with volume

**Best for**: High-volume items, catching breakouts

**Config**: `strategies.volume`
- `lookbackPeriod`: Days for volume average (default: 10)
- `profitCap`: Maximum profit target (default: 10%)

---

### 4. RSI Strategy (NEW)
**What it does**: Uses Relative Strength Index to identify overbought/oversold conditions.

**Data used**:
- Price changes over 14 periods
- Calculates RSI (0-100 scale)

**Best for**: Identifying entry/exit points, avoiding bad timing

**Config**: `strategies.rsi`
- `period`: RSI calculation period (default: 14)
- `overbought`: RSI level for sell signal (default: 70)
- `oversold`: RSI level for buy signal (default: 30)

---

### 5. Moving Average Strategy (NEW)
**What it does**: Uses moving average crossovers (Golden Cross/Death Cross) to identify trends.

**Data used**:
- Short-term MA (10 days)
- Long-term MA (20 days)
- Price position relative to MAs

**Best for**: Trend following, confirming other signals

**Config**: `strategies.movingAverage`
- `shortPeriod`: Short MA period (default: 10)
- `longPeriod`: Long MA period (default: 20)

---

### 6. Support/Resistance Strategy (NEW)
**What it does**: Identifies key price levels where price tends to bounce or reverse.

**Data used**:
- Local price minima (support)
- Local price maxima (resistance)
- Current price proximity to these levels

**Best for**: Range trading, identifying entry/exit levels

**Config**: `strategies.supportResistance`
- `lookbackPeriod`: Days to analyze (default: 30)
- `proximityThreshold`: How close to level to trigger (default: 2%)

---

## Strategy Aggregation

All strategies vote on BUY/SELL/HOLD, and the SignalGenerator:
- Aggregates votes (majority wins)
- Averages confidence scores
- Combines exit price targets
- Applies realistic profit caps (5-20%)

## Best Strategies for RuneScape Trading

Based on RuneScape market characteristics:

1. **Mean Reversion** - Works well because many items have price floors/floors
2. **Volume Strategy** - Important for identifying real moves vs noise
3. **Support/Resistance** - Many items trade in ranges
4. **RSI** - Good for timing entries/exits
5. **Momentum** - Works for trending items
6. **Moving Average** - Confirms other signals

## Historical Data Sources

### Primary Source: RuneScape Wiki API
- **Endpoint**: `https://prices.runescape.wiki/api/v1/osrs`
- **Latest Prices**: `/latest?id={itemId}`
- **Historical Data**: `/timeseries?id={itemId}&timestep=1d&count={days}`
- **Data Available**: High/low prices, volume, timestamps
- **Limitations**: Free API, rate limits may apply

### Alternative Sources (Future)
- OSRS GE Tracker (if API available)
- Grand Exchange Market Watch
- Custom data collection

## Recommendations

1. **Use all 6 strategies** - They complement each other
2. **Adjust confidence thresholds** - Higher confidence = fewer but better signals
3. **Monitor strategy performance** - Some may work better for specific items
4. **Combine signals** - Multiple strategies agreeing = higher confidence

## Future Strategy Ideas

- **Bollinger Bands**: Volatility-based trading
- **MACD**: Momentum and trend confirmation
- **Order Book Analysis**: If available
- **Market Sentiment**: News/update impact
- **Seasonal Patterns**: Time-based patterns
