import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";
import { Settings } from "../../src/config/Settings.js";

describe("TradingBot - Duplicate Messages", () => {
  test("should only print 'Analyzing market...' once per analysis", async () => {
    const settings = new Settings();
    await settings.load();

    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(3);
    const minConfidence = 0.5;

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      minConfidence,
      settings,
    });

    const items = ["Iron ore", "Coal"];
    
    // Capture console output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(" "));
    };

    try {
      await bot.analyzeMarket(items);
      
      // Count "Analyzing market" messages
      const analyzingMessages = logs.filter(log => 
        log.includes("Analyzing market")
      );
      
      // Should only appear once
      assert.strictEqual(
        analyzingMessages.length, 
        1, 
        `Expected 1 "Analyzing market" message, got ${analyzingMessages.length}`
      );
    } finally {
      console.log = originalLog;
    }
  });
});
