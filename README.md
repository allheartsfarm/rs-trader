# RuneScape Trading Bot

A Node.js bot for planning and executing trades on RuneScape's Grand Exchange. Designed for Free-to-Play accounts with a 3-item trading limit.

**License:** MIT — see [LICENSE](./LICENSE).

## Features

- Historical trade data fetching and analysis
- Multiple trading algorithms for signal generation
- Position management (max 3 items for F2P)
- Entry/exit signal generation
- Trade recommendations with buy/sell prices

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment template (optional):
```bash
cp .env.example .env
# Edit .env if you need non-interactive mode (e.g. SKIP_INTERACTIVE=true)
```

3. Run the bot:
```bash
npm start
```

## Usage

The bot will:
- Fetch historical price data for items
- Run trading algorithms to generate signals
- Recommend trades based on your F2P limitations (3 items max)
- Provide entry prices, quantities, and exit targets

## Development (TDD)

This project follows **Test-Driven Development** principles:

1. **Write tests first** (RED phase)
2. **Implement minimum code** (GREEN phase)
3. **Refactor** while keeping tests passing

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (recommended for TDD)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests (tests real API calls)
npm run test:integration
```

**Note:** Integration tests make actual API calls to the RuneScape Wiki API. They verify that:
- API endpoints are accessible
- Data is fetched correctly
- Error handling works properly
- The full trading workflow functions end-to-end

See [TDD.md](./TDD.md) for detailed TDD rules and workflow.

## Trading Algorithms

- Momentum-based trading
- Mean reversion
- Volume analysis
- Price breakouts
- Support/resistance levels
