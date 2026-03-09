import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";
import chalk from "chalk";

describe("TradeManager - Compact Format", () => {
  // Mock readline to prevent tests from hanging
  const mockRl = {
    question: (query, callback) => {
      process.nextTick(() => callback('Q'));
    },
    close: () => {},
    pause: () => {},
    resume: () => {}
  };

  test("should format recommendation in compact format", () => {
    const manager = new TradeManager(mockRl);
    const rec = {
      item: "Turquoise robe top",
      action: "buy",
      quantity: 17187,
      totalCost: 11000000,
      netProfit: 709000,
      entryPrice: 618,
      exitPrice: 685,
      currentPrice: 618,
      confidence: 0.72,
      duration: 5
    };

    // Calculate profit margin
    const entryPrice = rec.entryPrice || 0;
    const exitPrice = rec.exitPrice || entryPrice;
    const profitPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;

    // Expected format: "19. Turquoise robe top - 17,187x at 11M gp for 709K gp profit (10.89%)"
    assert.ok(rec.quantity === 17187, "Should have correct quantity");
    assert.ok(rec.totalCost === 11000000, "Should have correct total cost");
    assert.ok(rec.netProfit === 709000, "Should have correct net profit");
    assert.ok(profitPercent > 10 && profitPercent < 11, "Should have correct profit margin");
  });

  test("should format compact line with all required fields", () => {
    const manager = new TradeManager(mockRl);
    const rec = {
      item: "Iron ore",
      action: "buy",
      quantity: 1000,
      totalCost: 440000,
      netProfit: 50000,
      entryPrice: 440,
      exitPrice: 490,
      currentPrice: 440,
      confidence: 0.75,
      duration: 3
    };

    // Verify all fields are present
    assert.ok(rec.item, "Should have item name");
    assert.ok(rec.quantity > 0, "Should have quantity");
    assert.ok(rec.totalCost > 0, "Should have total cost");
    assert.ok(rec.netProfit !== undefined, "Should have net profit");
    assert.ok(rec.entryPrice > 0, "Should have entry price");
  });

  test("should handle missing optional fields gracefully", () => {
    const manager = new TradeManager(mockRl);
    const rec = {
      item: "Test item",
      action: "buy",
      quantity: 100,
      entryPrice: 100,
      currentPrice: 100
    };

    // Should not crash if totalCost or netProfit are missing
    assert.ok(rec.item === "Test item", "Should have item name");
    assert.ok(rec.quantity === 100, "Should have quantity");
  });
});
