# Project Structure

## Overview

This is a TDD-based RuneScape Grand Exchange trading bot built with Node.js.

## Directory Structure

```
rs-trader/
├── src/                          # Source code
│   ├── index.js                  # Entry point
│   ├── bot/                      # Bot components
│   │   ├── TradingBot.js         # Main bot orchestrator
│   │   └── PositionManager.js    # Manages F2P position limits (3 items)
│   ├── data/                     # Data fetching
│   │   └── DataFetcher.js        # Fetches historical and current prices
│   └── algorithms/               # Trading algorithms
│       ├── SignalGenerator.js    # Aggregates signals from strategies
│       └── strategies/            # Individual trading strategies
│           ├── MomentumStrategy.js
│           ├── MeanReversionStrategy.js
│           └── VolumeStrategy.js
├── tests/                        # Test files (mirrors src structure)
│   ├── bot/
│   ├── data/
│   └── algorithms/
│       └── strategies/
├── package.json                  # Dependencies and scripts
├── TDD.md                       # TDD rules and workflow
└── README.md                    # Project documentation
```

## Components

### TradingBot
Main orchestrator that:
- Coordinates data fetching
- Generates trading signals
- Manages positions
- Displays recommendations

### PositionManager
Handles F2P limitations:
- Maximum 3 positions
- Add/remove positions
- Track entry prices and quantities

### DataFetcher
Fetches market data:
- Historical price data (30 days default)
- Current market prices
- Caching for performance

### SignalGenerator
Aggregates signals from multiple strategies:
- MomentumStrategy
- MeanReversionStrategy
- VolumeStrategy

## Trading Strategies

1. **Momentum Strategy**: Identifies trends and momentum
2. **Mean Reversion Strategy**: Finds deviations from mean price
3. **Volume Strategy**: Analyzes trading volume patterns

## TDD Workflow

1. Write failing test (RED)
2. Implement minimum code (GREEN)
3. Refactor while keeping tests passing

Run `npm run test:watch` for continuous testing during development.
