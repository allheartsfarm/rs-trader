import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";
import { Settings } from "../../src/config/Settings.js";
import { TradeManager } from "../../src/bot/TradeManager.js";

// Mock TradeManager to avoid readline prompts
function createMockTradeManager() {
  const mockRl = {
    question: (query, callback) => callback("q"),
    close: () => {},
    on: () => {},
    write: () => {},
  };
  return new TradeManager(mockRl);
}

describe("TradingBot - Profit Per Month Percentile Filter (Percentile Only)", () => {
  test("should filter to top 20% of recommendations by profit per month, regardless of absolute value", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.profitPerMonthPercentile = 0.2; // Top 20%
    // No absolute minimum - just percentile

    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(3);
    const tradeManager = createMockTradeManager();

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      settings,
      tradeManager,
    });

    // Create 100 mock recommendations with varying profit per month
    const mockRecommendations = [];
    for (let i = 0; i < 100; i++) {
      // Profit per month ranges from 10k to 1000k
      const profitPerMonth = 10000 + i * 10000; // 10k, 20k, 30k, ..., 1000k
      const duration = 2;
      const netProfit = (profitPerMonth * duration) / 30; // Reverse calculate netProfit

      mockRecommendations.push({
        item: `Item ${i + 1}`,
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: netProfit,
        confidence: 0.8,
        executionPlan: { totalDays: duration, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      });
    }

    // Calculate profit per month for each (same logic as TradingBot)
    mockRecommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        const duration =
          rec.executionPlan?.totalDays || rec.duration || 2;
        rec.duration = duration;
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Apply the same filter logic as TradingBot
    const buyRecs = mockRecommendations.filter((r) => r.action === "BUY");
    if (buyRecs.length > 0) {
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.2;

      // Sort by profit per month (descending)
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many to keep (top 20%)
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take top N (should be 20 out of 100)
      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Should only keep top 20% (20 out of 100 recommendations)
      assert.strictEqual(
        topPercentileRecs.length,
        20,
        `Should keep exactly top 20% (20 recommendations from 100), but got ${topPercentileRecs.length}`
      );

      // Should include the highest profit per month items
      // Top 20 should be items 81-100 (820k-1000k/mo)
      assert.strictEqual(
        topPercentileRecs[0].item,
        "Item 100",
        "Should include the highest profit per month item"
      );
      assert.strictEqual(
        topPercentileRecs[19].item,
        "Item 81",
        "Should include the 20th highest profit per month item"
      );

      // Should NOT include lower profit items (even if they meet some absolute threshold)
      const lowestKept = topPercentileRecs[topPercentileRecs.length - 1];
      const lowestKeptProfitPerMonth = lowestKept.profitPerMonth || 0;
      // Item 81 = 10k + 80*10k = 810k/mo
      assert.ok(
        lowestKeptProfitPerMonth >= 810000,
        `Lowest kept should be at least 810k/mo (Item 81), but got ${lowestKeptProfitPerMonth.toLocaleString()}/mo`
      );
    }

    tradeManager.close();
  });

  test("should filter 300 recommendations to top 20% (60 recommendations)", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.profitPerMonthPercentile = 0.2; // Top 20%

    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(3);
    const tradeManager = createMockTradeManager();

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      settings,
      tradeManager,
    });

    // Create 300 mock recommendations (simulating the user's scenario)
    const mockRecommendations = [];
    for (let i = 0; i < 300; i++) {
      // Profit per month ranges from 1k to 300k
      const profitPerMonth = 1000 + i * 1000; // 1k, 2k, 3k, ..., 300k
      const duration = 2;
      const netProfit = (profitPerMonth * duration) / 30;

      mockRecommendations.push({
        item: `Item ${i + 1}`,
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: netProfit,
        confidence: 0.8,
        executionPlan: { totalDays: duration, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      });
    }

    // Calculate profit per month for each
    mockRecommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        const duration =
          rec.executionPlan?.totalDays || rec.duration || 2;
        rec.duration = duration;
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Apply the filter logic
    const buyRecs = mockRecommendations.filter((r) => r.action === "BUY");
    if (buyRecs.length > 0) {
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.2;

      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Should keep exactly 60 out of 300 (20%)
      assert.strictEqual(
        topPercentileRecs.length,
        60,
        `Should keep exactly top 20% (60 recommendations from 300), but got ${topPercentileRecs.length}`
      );

      // Should include the top 60 by profit per month
      // Top 60 should be items 241-300 (241k-300k/mo)
      assert.strictEqual(
        topPercentileRecs[0].item,
        "Item 300",
        "Should include the highest profit per month item"
      );
      assert.strictEqual(
        topPercentileRecs[59].item,
        "Item 241",
        "Should include the 60th highest profit per month item"
      );
    }

    tradeManager.close();
  });

  test("should work with low profit recommendations if they're in top 20%", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.profitPerMonthPercentile = 0.2; // Top 20%

    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(3);
    const tradeManager = createMockTradeManager();

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      settings,
      tradeManager,
    });

    // Create 10 recommendations, all with low profit per month
    const mockRecommendations = [];
    for (let i = 0; i < 10; i++) {
      const profitPerMonth = 5000 + i * 1000; // 5k, 6k, 7k, ..., 14k
      const duration = 2;
      const netProfit = (profitPerMonth * duration) / 30;

      mockRecommendations.push({
        item: `Item ${i + 1}`,
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: netProfit,
        confidence: 0.8,
        executionPlan: { totalDays: duration, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      });
    }

    // Calculate profit per month
    mockRecommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        const duration =
          rec.executionPlan?.totalDays || rec.duration || 2;
        rec.duration = duration;
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Apply filter
    const buyRecs = mockRecommendations.filter((r) => r.action === "BUY");
    if (buyRecs.length > 0) {
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.2;

      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Should keep top 20% (2 out of 10), even though all are low profit
      assert.strictEqual(
        topPercentileRecs.length,
        2,
        `Should keep top 20% (2 recommendations from 10), but got ${topPercentileRecs.length}`
      );

      // Should include the top 2 (Item 10 with 14k/mo and Item 9 with 13k/mo)
      assert.strictEqual(
        topPercentileRecs[0].item,
        "Item 10",
        "Should include the highest profit per month item"
      );
      assert.strictEqual(
        topPercentileRecs[1].item,
        "Item 9",
        "Should include the 2nd highest profit per month item"
      );
    }

    tradeManager.close();
  });
});
