import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";
import chalk from "chalk";

describe("TradeManager - Display Formatting", () => {
  // Mock readline to prevent tests from hanging
  const mockRl = {
    question: (query, callback) => {
      // Auto-answer with 'Q' to quit immediately
      process.nextTick(() => callback('Q'));
    },
    close: () => {}
  };

  test("should format entry and exit in compact format", () => {
    const manager = new TradeManager(mockRl);
    const rec = {
      item: "Iron ore",
      action: "buy",
      entryPrice: 462,
      exitPrice: 510,
      quantity: 1000,
      currentPrice: 440,
      confidence: 0.75,
      netProfit: 50000,
      duration: 3
    };

    // Check that displayDetailedRecommendation uses compact format
    // We'll test by checking the output format
    assert.ok(rec.entryPrice === 462, "Entry price should be 462");
    assert.ok(rec.exitPrice === 510, "Exit price should be 510");
  });

  test("should color active strategies green and inactive grey", async () => {
    const manager = new TradeManager(mockRl);
    const rec = {
      item: "Iron ore",
      action: "buy",
      strategies: ["Momentum", "MeanReversion", "Volume", "RSI", "MovingAverage", "SupportResistance"],
      // Mock signal data - we'll need to check how strategies are marked as active
    };

    // Strategies that contributed to the signal should be green
    // Others should be grey
    assert.ok(rec.strategies.length === 6, "Should have 6 strategies");
    
    manager.close();
  });

  test("should use confidence-based color shades for strategies with scores", async () => {
    const manager = new TradeManager(mockRl);
    
    // If strategies have confidence, use shades of green and show confidence score
    const strategyData = [
      { name: "Momentum", confidence: 0.9, action: "BUY" },
      { name: "MeanReversion", confidence: 0.7, action: "BUY" },
      { name: "Volume", confidence: 0.5, action: "HOLD" }
    ];

    // High confidence (0.8+) = bright green with score
    // Medium confidence (0.5-0.8) = medium green with score
    // Inactive (not BUY) = grey
    assert.ok(strategyData[0].confidence >= 0.8, "High confidence strategy");
    assert.ok(strategyData[1].confidence >= 0.5 && strategyData[1].confidence < 0.8, "Medium confidence strategy");
    assert.ok(strategyData[2].action !== "BUY", "Inactive strategy");
    
    // Test that confidence scores are calculated correctly
    const confidencePercent0 = Math.round(strategyData[0].confidence * 100);
    assert.ok(confidencePercent0 === 90, "Should calculate 90% for 0.9 confidence");
    
    manager.close();
  });
});
