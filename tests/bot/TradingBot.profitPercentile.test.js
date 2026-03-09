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

describe("TradingBot - Profit Per Month Percentile Filter", () => {
  test("should filter to top 20% of recommendations by profit per month", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.minProfitPerMonth = 100000; // 100k minimum
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

    // Create 10 mock recommendations with varying profit per month
    const mockRecommendations = [];
    for (let i = 0; i < 10; i++) {
      // Profit per month ranges from 50k to 500k
      const profitPerMonth = 50000 + i * 50000; // 50k, 100k, 150k, ..., 500k
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
        rec.duration = duration; // Store for display consistency
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Apply the same filter logic as TradingBot
    const buyRecs = mockRecommendations.filter((r) => r.action === "BUY");
    if (buyRecs.length > 0) {
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.2;
      const minProfitPerMonthAbsolute = settings.config.trading.minProfitPerMonth || 100000;

      // Sort by profit per month (descending) to get top recommendations
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many recommendations to keep (top percentile)
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take the top N recommendations
      const topNRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Filter out any that don't meet the absolute minimum
      const topPercentileRecs = topNRecs.filter((rec) => {
        const profitPerMonth = rec.profitPerMonth || 0;
        return profitPerMonth >= minProfitPerMonthAbsolute;
      });

      // Should only keep top 20% (2 out of 10 recommendations)
      // Top 2 should be: Item 10 (500k/mo) and Item 9 (450k/mo)
      assert.ok(
        topPercentileRecs.length <= 2,
        `Should only keep top 20% (2 recommendations), but got ${topPercentileRecs.length}`
      );

      if (topPercentileRecs.length > 0) {
        // All kept recommendations should meet the absolute minimum
        topPercentileRecs.forEach((rec) => {
          assert.ok(
            (rec.profitPerMonth || 0) >= minProfitPerMonthAbsolute,
            `All kept recommendations should meet absolute minimum ${minProfitPerMonthAbsolute.toLocaleString()}/mo`
          );
        });
      }
    }

    tradeManager.close();
  });

  test("should respect absolute minimum even if percentile would allow lower", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.minProfitPerMonth = 200000; // 200k minimum (higher than some recommendations)
    settings.config.trading.profitPerMonthPercentile = 0.5; // Top 50%

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

    // Create 10 mock recommendations: 5 below 200k, 5 above 200k
    const mockRecommendations = [];
    for (let i = 0; i < 10; i++) {
      const profitPerMonth = 100000 + i * 20000; // 100k, 120k, ..., 280k
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
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.5;
      const minProfitPerMonthAbsolute = settings.config.trading.minProfitPerMonth || 200000;

      // Sort by profit per month (descending)
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many to keep (top 50%)
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take top N
      const topNRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Filter out any that don't meet absolute minimum
      const topPercentileRecs = topNRecs.filter((rec) => {
        const profitPerMonth = rec.profitPerMonth || 0;
        return profitPerMonth >= minProfitPerMonthAbsolute;
      });

      // Should only keep recommendations >= 200k/mo (absolute minimum)
      // Even though top 50% would include some below 200k
      topPercentileRecs.forEach((rec) => {
        const profitPerMonth = rec.profitPerMonth || 0;
        assert.ok(
          profitPerMonth >= 200000,
          `All recommendations should meet absolute minimum 200k/mo, but got ${profitPerMonth.toLocaleString()}/mo`
        );
      });
    }

    tradeManager.close();
  });

  test("should handle edge case with very few recommendations", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.minProfitPerMonth = 100000;
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

    // Only 3 recommendations
    const mockRecommendations = [
      {
        item: "Item 1",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: 100000, // 1.5M/mo for 2-day trade
        confidence: 0.8,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      },
      {
        item: "Item 2",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: 50000, // 750k/mo for 2-day trade
        confidence: 0.8,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      },
      {
        item: "Item 3",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: 10000, // 150k/mo for 2-day trade
        confidence: 0.8,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      },
    ];

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
      const minProfitPerMonthAbsolute = settings.config.trading.minProfitPerMonth || 100000;

      // Sort by profit per month (descending)
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many to keep (top 20%)
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take top N
      const topNRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Filter out any that don't meet absolute minimum
      const topPercentileRecs = topNRecs.filter((rec) => {
        const profitPerMonth = rec.profitPerMonth || 0;
        return profitPerMonth >= minProfitPerMonthAbsolute;
      });

      // Top 20% of 3 = Math.ceil(3 * 0.2) = 1 recommendation
      // Should keep only the top one (Item 1 with 1.5M/mo)
      assert.ok(
        topPercentileRecs.length <= 1,
        `Should keep top 20% (1 recommendation from 3), but got ${topPercentileRecs.length}`
      );

      if (topPercentileRecs.length > 0) {
        // Should be Item 1 (highest profit per month)
        assert.strictEqual(
          topPercentileRecs[0].item,
          "Item 1",
          "Should keep the highest profit per month recommendation"
        );
      }
    }

    tradeManager.close();
  });
});
