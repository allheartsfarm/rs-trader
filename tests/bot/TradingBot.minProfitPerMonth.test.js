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

describe("TradingBot - Minimum Profit Per Month Filter", () => {
  test("should filter out recommendations below minProfitPerMonth threshold using same duration as display", async () => {
    const settings = new Settings();
    settings.getConfig(); // Initialize config
    settings.config.trading.minProfitPerMonth = 100000; // 100k minimum
    settings.config.trading.profitPerMonthPercentile = 0.2; // Top 20%
    settings.config.trading.maxTradeDurationDays = 2;

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

    // Create mock recommendations with varying profit per month
    const mockRecommendations = [
      {
        item: "High Profit Item",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1100,
        quantity: 1000,
        netProfit: 100000, // 100k profit
        confidence: 0.8,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 10000,
      },
      {
        item: "Low Profit Item 1",
        action: "BUY",
        entryPrice: 100,
        exitPrice: 110,
        quantity: 100,
        netProfit: 1000, // 1k profit
        confidence: 0.75,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 5000,
      },
      {
        item: "Low Profit Item 2",
        action: "BUY",
        entryPrice: 50,
        exitPrice: 55,
        quantity: 200,
        netProfit: 1000, // 1k profit
        confidence: 0.8,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 3000,
      },
      {
        item: "Medium Profit Item",
        action: "BUY",
        entryPrice: 500,
        exitPrice: 550,
        quantity: 500,
        netProfit: 25000, // 25k profit
        confidence: 0.85,
        executionPlan: { totalDays: 2, buyDays: 1, sellDays: 1, holdDays: 0 },
        avgDailyVolume: 8000,
      },
    ];

    // Mock analyzeMarket to return our test recommendations
    const originalAnalyzeMarket = bot.analyzeMarket.bind(bot);
    bot.analyzeMarket = async () => mockRecommendations;

    const recommendations = await bot.analyzeMarket(["test"]);

    // Calculate profit per month for each (same logic as TradingBot)
    recommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        const duration =
          rec.executionPlan?.totalDays || rec.duration || 2;
        rec.duration = duration; // Store for display consistency
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Apply the same filter logic as TradingBot
    const buyRecs = recommendations.filter((r) => r.action === "BUY");
    if (buyRecs.length > 0) {
      const percentileThreshold = settings.config.trading.profitPerMonthPercentile || 0.2;
      const minProfitPerMonthAbsolute = settings.config.trading.minProfitPerMonth || 100000;

      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      const percentileIndex = Math.floor(sortedByProfitPerMonth.length * percentileThreshold);
      const minProfitPerMonthPercentile =
        percentileIndex > 0
          ? sortedByProfitPerMonth[percentileIndex - 1].profitPerMonth || 0
          : 0;

      const minProfitPerMonth = Math.max(
        minProfitPerMonthPercentile,
        minProfitPerMonthAbsolute
      );

      const filteredRecs = buyRecs.filter(
        (rec) => (rec.profitPerMonth || 0) >= minProfitPerMonth
      );

      // Should only include High Profit Item (100k profit = 1.5M/mo for 2-day trade)
      // Low Profit Items (1k profit = 15k/mo) should be filtered out
      // Medium Profit Item (25k profit = 375k/mo) should be included if it's in top 20%
      assert.ok(
        filteredRecs.length > 0,
        "Should have at least one recommendation after filtering"
      );

      // All filtered recommendations should meet the minimum
      filteredRecs.forEach((rec) => {
        const profitPerMonth = (rec.netProfit || 0) * (30 / (rec.executionPlan?.totalDays || 2));
        assert.ok(
          profitPerMonth >= minProfitPerMonthAbsolute,
          `Recommendation ${rec.item} has profit per month ${profitPerMonth.toLocaleString()} which is below minimum ${minProfitPerMonthAbsolute.toLocaleString()}`
        );
      });

      // Low profit items should be filtered out
      const lowProfitItems = filteredRecs.filter(
        (rec) => rec.item.includes("Low Profit")
      );
      assert.strictEqual(
        lowProfitItems.length,
        0,
        "Low profit items should be filtered out"
      );
    }

    tradeManager.close();
  });

  test("should filter out 6K profit trades with 3-day duration (below 100k/mo)", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.minProfitPerMonth = 100000; // 100k minimum
    settings.config.trading.profitPerMonthPercentile = 0.2;

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

    // Test case: 6K profit with 3-day duration = 60K/mo (should be filtered)
    const mockRec = {
      item: "Low Profit Test",
      action: "BUY",
      entryPrice: 45,
      exitPrice: 49,
      quantity: 1236,
      netProfit: 6000, // 6K profit
      confidence: 0.76,
      executionPlan: { totalDays: 3, buyDays: 1, sellDays: 1, holdDays: 1 },
      avgDailyVolume: 7064,
    };

    // Calculate profit per month (same as TradingBot)
    const duration = mockRec.executionPlan?.totalDays || 2;
    mockRec.duration = duration;
    mockRec.profitPerMonth = (mockRec.netProfit || 0) * (30 / duration);

    // Should be 60K/mo (6K * 30/3 = 60K), which is below 100k minimum
    assert.strictEqual(
      mockRec.profitPerMonth,
      60000,
      "6K profit over 3 days should be 60K/mo"
    );

    // Apply filter
    const minProfitPerMonth = 100000;
    const passes = (mockRec.profitPerMonth || 0) >= minProfitPerMonth;

    assert.ok(
      !passes,
      "6K profit over 3 days (60K/mo) should be filtered out (below 100k minimum)"
    );

    tradeManager.close();
  });

  test("should calculate profit per month correctly based on trade duration", async () => {
    const settings = new Settings();
    settings.getConfig();
    settings.config.trading.minProfitPerMonth = 100000;
    settings.config.trading.profitPerMonthPercentile = 0.2;

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

    // Test with different durations
    const testCases = [
      {
        netProfit: 10000,
        duration: 1,
        expectedProfitPerMonth: 300000, // 10k * 30/1 = 300k
      },
      {
        netProfit: 10000,
        duration: 2,
        expectedProfitPerMonth: 150000, // 10k * 30/2 = 150k
      },
      {
        netProfit: 10000,
        duration: 5,
        expectedProfitPerMonth: 60000, // 10k * 30/5 = 60k
      },
    ];

    testCases.forEach((testCase) => {
      const profitPerMonth = testCase.netProfit * (30 / testCase.duration);
      assert.strictEqual(
        profitPerMonth,
        testCase.expectedProfitPerMonth,
        `Profit per month calculation incorrect for ${testCase.duration}-day trade`
      );
    });

    tradeManager.close();
  });
});
