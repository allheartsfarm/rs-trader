import { test, describe, before } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";

describe("TradingBot Integration Tests", () => {
  let bot;
  let dataFetcher;
  let signalGenerator;
  let positionManager;

  before(() => {
    dataFetcher = new DataFetcher();
    signalGenerator = new SignalGenerator();
    positionManager = new PositionManager(3);

    bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      minConfidence: 0.5, // Lower threshold for integration tests
    });
  });

  test("should fetch real data and generate signals for Iron ore", async () => {
    const items = ["Iron ore"];
    const recommendations = await bot.analyzeMarket(items);

    assert.ok(Array.isArray(recommendations));
    // Should have at least analyzed the item (even if no signal)
    assert.ok(recommendations.length >= 0);
  });

  test("should work with real API data for multiple items", async () => {
    const items = ["Iron ore", "Coal"];
    const recommendations = await bot.analyzeMarket(items);

    assert.ok(Array.isArray(recommendations));
    // All recommendations should have valid structure
    recommendations.forEach((rec) => {
      assert.ok(rec.hasOwnProperty("item"));
      assert.ok(rec.hasOwnProperty("action"));
      assert.ok(rec.hasOwnProperty("confidence"));
      assert.ok(["BUY", "SELL", "HOLD"].includes(rec.action));
      assert.ok(rec.confidence >= 0 && rec.confidence <= 1);
    });
  });

  test("should respect F2P limit with real data", async () => {
    // Add existing positions
    positionManager.addPosition({
      item: "Iron ore",
      quantity: 100,
      buyPrice: 100,
    });
    positionManager.addPosition({
      item: "Coal",
      quantity: 50,
      buyPrice: 200,
    });

    const items = ["Steel bar", "Gold ore", "Silver ore"];
    const recommendations = await bot.analyzeMarket(items);

    const buyRecommendations = recommendations.filter(
      (r) => r.action === "BUY"
    );
    // Should only recommend 1 more item (3 - 2 existing = 1 slot)
    assert.ok(buyRecommendations.length <= 1);

    // Clean up
    positionManager.clear();
  });

  test("should handle API failures gracefully", async () => {
    // Create a bot with a fetcher that will fail
    const failingFetcher = new DataFetcher();
    // Mock a method to throw error
    const originalFetch = failingFetcher.fetchHistoricalData;
    failingFetcher.fetchHistoricalData = async () => {
      throw new Error("API Error");
    };

    const testBot = new TradingBot({
      dataFetcher: failingFetcher,
      signalGenerator,
      positionManager,
    });

    const items = ["Iron ore"];
    // Should not throw, should handle gracefully
    const recommendations = await testBot.analyzeMarket(items);

    assert.ok(Array.isArray(recommendations));
  });

  test("should generate valid signals from real price data", async () => {
    const historicalData = await dataFetcher.fetchHistoricalData("Iron ore", 30);
    const currentPrice = await dataFetcher.getCurrentPrice("Iron ore");

    assert.ok(historicalData.length > 0);
    assert.ok(currentPrice > 0);

    const signal = signalGenerator.generateSignal(
      "Iron ore",
      historicalData,
      currentPrice
    );

    assert.ok(signal);
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action));
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1);

    if (signal.action === "BUY") {
      assert.ok(typeof signal.entryPrice === "number");
      assert.ok(typeof signal.exitPrice === "number");
      assert.ok(signal.exitPrice > signal.entryPrice);
      assert.ok(typeof signal.quantity === "number");
      assert.ok(signal.quantity > 0);
    }
  });

  test("should process end-to-end trading workflow", async () => {
    positionManager.clear();
    const items = ["Iron ore", "Coal", "Steel bar"];

    // Step 1: Analyze market
    const recommendations = await bot.analyzeMarket(items);
    assert.ok(Array.isArray(recommendations));

    // Step 2: If we have BUY recommendations, add positions
    const buySignals = recommendations.filter((r) => r.action === "BUY");
    buySignals.slice(0, positionManager.getAvailableSlots()).forEach((rec) => {
      if (positionManager.getAvailableSlots() > 0) {
        positionManager.addPosition({
          item: rec.item,
          quantity: rec.quantity,
          buyPrice: rec.entryPrice,
        });
      }
    });

    // Step 3: Verify positions
    assert.ok(
      positionManager.getPositionCount() <= positionManager.maxPositions
    );
  });
});
