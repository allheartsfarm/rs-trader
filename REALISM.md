# Trade Realism Validation

## Current Validation Rules

The bot now includes multiple layers of realism validation:

### 1. Profit Margin Caps
- **2-day trades**: Max 20% profit margin (capped at 15% if historical data doesn't support higher)
- **Longer trades**: Up to 20% based on settings
- **Minimum**: 5% profit margin

### 2. Historical Price Validation
- Exit prices cannot exceed historical maximum by more than 10%
- For high-profit trades (>20% margin), stricter cap: only 5% above historical max
- Validates against 30 days of historical data

### 3. Volume Feasibility
- Checks if trade can complete within 2 days based on average daily volume
- Uses 50% of available volume as safety margin
- Warns if volume may extend completion time

### 4. GE Fee Accounting
- 2% fee for items > 50 GP (both buy and sell)
- Net profit calculated after all fees
- Exit prices adjusted to account for fees

### 5. Profit Target Filtering
- **2-day trades**: Must meet 40% of minimum (200k GP) or have 85%+ confidence
- **Longer trades**: Must meet 95% of minimum (475k GP) or have 85%+ confidence
- Only profitable trades are shown

## Realistic Expectations

**For 2-day trades:**
- Typical profit: 200k-400k GP (not always 500k+)
- Profit margins: 10-15% are most realistic
- Higher margins (20%+) are possible but rare

**Why 500k is difficult in 2 days:**
- With 15% profit margin, need ~3.3M GP investment
- After fees, need even more
- Limited by position size (33% of capital = 3.3M)
- Volume constraints may limit quantity

## Recommendations

1. **For consistent 500k+ profits**: Consider 3-5 day trades instead of 2 days
2. **For quick flips**: Accept 200k-400k GP profits as realistic
3. **Monitor volume**: Low volume items may take longer than 2 days
4. **Check historical data**: Exit prices are validated against 30-day history

## Settings to Adjust

In `settings.json`:
- `maxTradeDurationDays`: Increase to 3-5 for higher profit targets
- `minProfitPerTrade`: Lower to 200k for more 2-day opportunities
- `profitTargetPercent.max`: Adjust based on your risk tolerance
