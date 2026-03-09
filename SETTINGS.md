# Settings Configuration

The `settings.json` file allows you to customize all trading parameters. Edit this file to adjust the bot's behavior.

## Trading Parameters

### Profit Targets
- `minProfitPerTrade`: Minimum profit per trade in GP (default: 500,000)
- `targetProfitPerTrade`: Target profit per trade in GP (default: 1,000,000)
- `baseCapital`: Your total trading capital in GP (default: 10,000,000)

### Position Management
- `maxPositions`: Maximum number of positions (3 for F2P, can be 1-3)
- `positionSizePercent`: Percentage of capital to use per position (default: 0.33 = 33%)
- `minConfidence`: Minimum confidence threshold for signals (0.0-1.0, default: 0.3)
- `maxTradeDurationDays`: Maximum days to hold a position (default: 2 for quick flips)

### Profit Margins
- `profitTargetPercent.min`: Minimum profit percentage (default: 0.05 = 5%)
- `profitTargetPercent.max`: Maximum profit percentage (default: 0.20 = 20%)
- `maxTradeDurationDays`: Maximum days to hold position (default: 2 for quick flips)

### Grand Exchange Fees
- **2% fee** applies to items above 50 GP (both buy and sell)
- **No fee** for items at or below 50 GP
- Fees are automatically factored into profit calculations
- Exit prices are adjusted to ensure net profit targets are met

## Strategy Parameters

### Momentum Strategy
- `strategies.momentum.lookbackPeriod`: Days to look back (default: 5)
- `strategies.momentum.profitCap`: Maximum profit cap (default: 0.12 = 12%)

### Mean Reversion Strategy
- `strategies.meanReversion.lookbackPeriod`: Days to look back (default: 20)
- `strategies.meanReversion.deviationThreshold`: Deviation threshold (default: 0.1 = 10%)
- `strategies.meanReversion.profitCap`: Maximum profit cap (default: 0.15 = 15%)

### Volume Strategy
- `strategies.volume.lookbackPeriod`: Days to look back (default: 10)
- `strategies.volume.profitCap`: Maximum profit cap (default: 0.10 = 10%)

## Data Settings
- `data.cacheTimeout`: Cache timeout in milliseconds (default: 300000 = 5 minutes)
- `data.historicalDays`: Days of historical data to fetch (default: 30)

## Example: Targeting Higher Profits

To target 2M GP per trade with 20M capital:

```json
{
  "trading": {
    "minProfitPerTrade": 1500000,
    "targetProfitPerTrade": 2000000,
    "baseCapital": 20000000,
    "maxTradeDurationDays": 2,
    "profitTargetPercent": {
      "min": 0.10,
      "max": 0.25
    }
  }
}
```

## Example: Longer-Term Trades

To allow longer holding periods (up to 5 days):

```json
{
  "trading": {
    "maxTradeDurationDays": 5
  }
}
```

## Example: More Conservative Trading

To be more conservative with lower capital:

```json
{
  "trading": {
    "minProfitPerTrade": 250000,
    "targetProfitPerTrade": 500000,
    "baseCapital": 5000000,
    "positionSizePercent": 0.25,
    "minConfidence": 0.5
  }
}
```

## Notes

- After editing `settings.json`, restart the bot for changes to take effect
- The bot will validate settings and use defaults for invalid values
- Profit calculations consider both profit targets and capital constraints
- Higher profit targets may require higher-priced items or larger position sizes
