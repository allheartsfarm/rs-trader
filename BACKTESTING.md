# Backtesting System Design

## Overview

The bot now collects historical data incrementally, building a database over time. This enables backtesting once we have sufficient historical data.

## Data Collection Strategy

### Incremental Collection

- **Never Delete**: Historical data is never deleted, only appended
- **Daily Updates**: Each day, fetch the latest data and merge with existing
- **Deduplication**: Data is deduplicated by date (YYYY-MM-DD) to prevent duplicates
- **Maximum Window**: Keeps last 365 days by default (configurable via `data.maxHistoricalDays`)

### How It Works

1. **First Run**: Fetches data from API (typically last 30 days)
2. **Subsequent Runs**: 
   - Checks if we already have today's data
   - If yes, returns cached data
   - If no, fetches new data and merges with existing
   - Only adds new dates, skips duplicates

### Cache Keys

- **Historical Database**: `{itemName}_historical` (persistent, never expires)
- **Request Cache**: `{itemName}_{days}` (temporary, for API request caching)

## API Update Frequency

Based on RuneScape Grand Exchange characteristics:

- **Update Frequency**: Once daily (typically at midnight UTC)
- **Data Granularity**: Daily aggregates (high, low, volume)
- **No Intraday Data**: Unlike stock markets, GE data is daily only
- **API Limit**: Typically provides last 30 days of historical data

## RuneScape-Specific Considerations

### Differences from Stock Markets

1. **No Intraday Trading**: 
   - GE updates once per day
   - No minute/hourly data available
   - Strategies should focus on daily patterns

2. **Market Hours**:
   - GE is always "open" (24/7)
   - But data only updates daily
   - No after-hours/pre-market considerations

3. **Volume Characteristics**:
   - Much lower volumes than stock markets
   - Some items have very low liquidity
   - Volume constraints are critical for realistic trades

4. **Price Movements**:
   - Generally more stable than stocks
   - Less volatility (no flash crashes)
   - Mean reversion strategies work well

5. **Data Availability**:
   - Limited historical data from API
   - Need to collect over time
   - Some items may have incomplete data

### Strategy Recommendations

Given RuneScape's characteristics:

1. **Mean Reversion** (Weight: 1.2) - Most important
   - Many items have price floors/ceilings
   - Works well with stable markets

2. **Volume Strategy** (Weight: 1.15) - Very important
   - Identifies real moves vs noise
   - Critical for feasibility

3. **Support/Resistance** (Weight: 1.1) - Important
   - Many items trade in ranges
   - Price levels matter

4. **RSI** (Weight: 1.0) - Good for timing
   - Helps avoid bad entry/exit points

5. **Momentum** (Weight: 0.9) - Works for trending items
   - Less common in RuneScape but still useful

6. **Moving Average** (Weight: 0.8) - Confirms signals
   - Less important alone, but confirms others

## Backtesting Foundation

### Current State

- ✅ Incremental data collection implemented
- ✅ Data deduplication by date
- ✅ Maximum window management (365 days)
- ⏳ Backtesting engine (future work)

### Future Backtesting Features

1. **Historical Signal Generation**
   - Run strategies on past data
   - Generate signals for each historical day
   - Track what signals would have been generated

2. **Performance Metrics**
   - Win rate
   - Average profit per trade
   - Maximum drawdown
   - Sharpe ratio (if applicable)

3. **Strategy Comparison**
   - Compare individual strategies
   - Compare strategy combinations
   - Identify best strategies for different items

4. **Walk-Forward Analysis**
   - Test on rolling windows
   - Avoid overfitting
   - Validate strategy robustness

5. **Risk Analysis**
   - Position sizing impact
   - Volume constraint impact
   - Fee impact on profitability

## Data Collection Schedule

### Recommended Collection Strategy

1. **Daily Collection**: Run bot daily to collect new data
2. **Automated Collection**: Set up cron job or scheduled task
3. **Data Validation**: Check for missing days, gaps in data
4. **Backup**: Periodically backup historical database

### Minimum Data for Backtesting

- **Short-term strategies** (1-5 days): Need ~30 days
- **Medium-term strategies** (5-20 days): Need ~90 days
- **Long-term strategies** (20+ days): Need ~180+ days
- **Full backtesting**: Need ~365 days for annual analysis

## Implementation Notes

### Data Structure

```javascript
{
  price: number,
  volume: number,
  timestamp: Date,
  // Normalized date for deduplication: YYYY-MM-DD
}
```

### Cache Structure

```javascript
{
  "{itemName}_historical": {
    data: Array<DataPoint>,
    timestamp: number, // Last update time
  }
}
```

### Usage

```javascript
// Incremental collection (default)
const data = await dataFetcher.fetchHistoricalData("Iron ore", 30, {
  incremental: true, // Merge with existing
  maxDays: 365, // Keep last 365 days
});

// Non-incremental (for testing)
const data = await dataFetcher.fetchHistoricalData("Iron ore", 30, {
  incremental: false, // Replace cache
});
```

## Next Steps

1. ✅ Implement incremental collection
2. ⏳ Add daily collection script
3. ⏳ Build backtesting engine
4. ⏳ Add performance metrics
5. ⏳ Create visualization tools
