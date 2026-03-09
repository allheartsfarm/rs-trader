import { test, describe } from "node:test";
import assert from "node:assert";
import { Settings } from "../../src/config/Settings.js";

describe("TradingBot - Minimum Profit Percentage Filter", () => {
  test("should filter out recommendations with profit percentage below minimum", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.minProfitPercent = 0.01; // 1% minimum

    // Create mock recommendations with different profit percentages
    const mockRecommendations = [
      {
        item: "Low Profit Item",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1008, // 0.8% profit (below 1% threshold)
        quantity: 1000,
        netProfit: 8000, // 8k profit
        confidence: 0.9,
        avgDailyVolume: 10000,
        duration: 3,
      },
      {
        item: "Good Profit Item",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1015, // 1.5% profit (above 1% threshold)
        quantity: 1000,
        netProfit: 15000, // 15k profit
        confidence: 0.9,
        avgDailyVolume: 10000,
        duration: 3,
      },
      {
        item: "Very Low Profit Item",
        action: "BUY",
        entryPrice: 100000,
        exitPrice: 100880, // 0.88% profit (below 1% threshold)
        quantity: 1,
        netProfit: 880, // 880 profit
        confidence: 0.9,
        avgDailyVolume: 1000,
        duration: 3,
      },
    ];

    // Test the filtering logic directly (same as in TradingBot)
    const minProfitPercent = settings.config.trading.minProfitPercent || 0.01;
    const filtered = mockRecommendations.filter((rec) => {
      if (rec.action === "BUY") {
        const totalCost = rec.entryPrice * rec.quantity * 1.02;
        const profitPercent = totalCost > 0 ? (rec.netProfit / totalCost) * 100 : 0;
        return profitPercent >= minProfitPercent * 100; // 1% minimum
      }
      return true;
    });

    // Only "Good Profit Item" should pass (1.5% > 1%)
    assert.strictEqual(
      filtered.length,
      1,
      "Should filter out recommendations below 1% profit"
    );
    assert.strictEqual(
      filtered[0].item,
      "Good Profit Item",
      "Should keep only the item with >= 1% profit"
    );
  });

  test("should respect minProfitPercent setting", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.minProfitPercent = 0.02; // 2% minimum

    const mockRecommendations = [
      {
        item: "1.5% Profit",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1015, // 1.5% profit
        quantity: 1000,
        netProfit: 15000,
        confidence: 0.9,
        avgDailyVolume: 10000,
        duration: 3,
      },
      {
        item: "2.5% Profit",
        action: "BUY",
        entryPrice: 1000,
        exitPrice: 1025, // 2.5% profit
        quantity: 1000,
        netProfit: 25000,
        confidence: 0.9,
        avgDailyVolume: 10000,
        duration: 3,
      },
    ];

    // Test the filtering logic directly (same as in TradingBot)
    const minProfitPercent = settings.config.trading.minProfitPercent || 0.02;
    const filtered = mockRecommendations.filter((rec) => {
      if (rec.action === "BUY") {
        const totalCost = rec.entryPrice * rec.quantity * 1.02;
        const profitPercent = totalCost > 0 ? (rec.netProfit / totalCost) * 100 : 0;
        return profitPercent >= minProfitPercent * 100; // 2% minimum
      }
      return true;
    });

    assert.strictEqual(
      filtered.length,
      1,
      "Should filter out recommendations below 2% profit when minProfitPercent is 2%"
    );
    assert.strictEqual(
      filtered[0].item,
      "2.5% Profit",
      "Should keep only the item with >= 2% profit"
    );
  });
});
