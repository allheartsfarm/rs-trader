# RuneScape Trading Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A Node.js bot for **planning and executing trades** on RuneScape's Grand Exchange. Designed for **Free-to-Play** accounts with a 3-item trading limit. Uses the public [OSRS Wiki API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) for historical and live price data.

## Table of contents

- [Features](#features)
- [Methodology](#methodology)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Development & testing](#development--testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Historical trade data** — Fetches and caches price/volume data from the RuneScape Wiki API
- **Multi-strategy ensemble** — Six algorithms (momentum, mean reversion, volume, RSI, moving average, support/resistance) with **configurable weights** and per-strategy confidence caps
- **F2P-aware** — Position management capped at 3 items; volume feasibility and execution plans
- **Signal generation** — Weighted combined confidence, consensus bonus, entry/exit prices, fee-adjusted profit targets
- **Realism layer** — GE fees (2%), historical exit caps, volume feasibility, profit-per-month percentile filter
- **Configurable** — All parameters in `settings.json` (see [SETTINGS.md](./SETTINGS.md))

## Methodology

The system is built so signals and execution would look familiar to a quant or risk-conscious team: **weighted multi-strategy ensemble**, **capacity-aware execution**, and **net P&L after costs**.

- **Ensemble weighting** — Each strategy has a `weight` and `maxConfidence` in config. Raw confidence is normalized by `maxConfidence`, then a **weighted average** of normalized confidences is taken; strategies that agree get a **consensus bonus**. So mean reversion (weight 1.2) and volume (1.15) drive the combined signal more than momentum (0.9) or moving average (0.8). See **[ALGORITHMS.md](./ALGORITHMS.md)** for the full weighting formula and strategy roles.
- **What’s unique in this codebase** — **(1)** **Volume feasibility**: required volume vs available volume over the trade window, so recommended size is **executable** in the GE. **(2)** **Execution plan**: buy/sell over how many days, execution risk (low/medium/high), and a simple slippage-style adjustment. **(3)** **Realism caps**: exit prices capped by historical high; profit margins and GE fees applied so all targets are **net of costs**. **(4)** **Profit-per-month percentile filter**: keep only the top fraction of BUY ideas by profit-per-month (e.g. top 20%), plus a minimum profit-per-month floor—capital allocation, not just “any edge.” **(5)** **Incremental, append-only history** for future backtesting.

For the full design rationale, strategy table, and code references, see **[ALGORITHMS.md](./ALGORITHMS.md)**.

## Requirements

- **Node.js** 18+ (ES modules)
- No API keys — uses public OSRS Wiki endpoints only

## Quick start

```bash
git clone https://github.com/allheartsfarm/rs-trader.git
cd rs-trader
npm install
npm start
```

Optional: copy `.env.example` to `.env` and set `SKIP_INTERACTIVE=true` for non-interactive runs (e.g. cron/CI).

## Configuration

Edit **`settings.json`** to tune:

- Capital, profit targets, max positions (3 for F2P)
- Strategy weights and lookback periods
- Cache timeout and historical window
- Min confidence and profit-per-month filters

See **[SETTINGS.md](./SETTINGS.md)** for all options and examples.

## Documentation

| Doc | Description |
|-----|-------------|
| **[ALGORITHMS.md](./ALGORITHMS.md)** | **Ensemble weighting, strategy roles, and what’s unique (volume feasibility, execution plan, realism, percentile filter)** |
| [SETTINGS.md](./SETTINGS.md) | Configuration reference and examples |
| [STRATEGIES.md](./STRATEGIES.md) | Trading algorithms and data they use |
| [BACKTESTING.md](./BACKTESTING.md) | Incremental data collection and backtesting design |
| [REALISM.md](./REALISM.md) | Profit caps, volume feasibility, GE fees |
| [TDD.md](./TDD.md) | Test-driven development workflow |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Code layout and components |

## Development & testing

The project is developed with **TDD** (see [TDD.md](./TDD.md)).

```bash
# Run all tests
npm test

# Watch mode (recommended while coding)
npm run test:watch

# Coverage
npm run test:coverage

# Integration tests (real Wiki API calls)
npm run test:integration
```

Integration tests hit the public RuneScape Wiki API; no credentials required.

## Contributing

Contributions are welcome. See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for how to run tests, open issues, and submit pull requests.

## License

MIT — see [LICENSE](./LICENSE).
