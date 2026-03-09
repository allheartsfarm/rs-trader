import chalk from 'chalk';
import { TradingBot } from './bot/TradingBot.js';
import { DataFetcher } from './data/DataFetcher.js';
import { SignalGenerator } from './algorithms/SignalGenerator.js';
import { PositionManager } from './bot/PositionManager.js';
import { Settings } from './config/Settings.js';

console.log(chalk.blue.bold('\n🏰 RuneScape Trading Bot 🏰\n'));

// Load settings
const settings = new Settings();
await settings.load();

const config = settings.getConfig();

console.log(chalk.yellow(`💰 Target Profit: ${(config.trading.targetProfitPerTrade / 1000).toFixed(0)}k gp per trade`));
console.log(chalk.yellow(`💵 Base Capital: ${(config.trading.baseCapital / 1000).toFixed(0)}k gp\n`));

// Initialize components
const dataFetcher = new DataFetcher();
const signalGenerator = new SignalGenerator(settings);
const positionManager = new PositionManager(config.trading.maxPositions);

const bot = new TradingBot({
  dataFetcher,
  signalGenerator,
  positionManager,
  settings
});

// Start the bot
bot.start().catch(console.error);
