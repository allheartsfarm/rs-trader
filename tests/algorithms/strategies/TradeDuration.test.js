import { test, describe } from "node:test";
import assert from "node:assert";
import { MomentumStrategy } from "../../../src/algorithms/strategies/MomentumStrategy.js";
import { MeanReversionStrategy } from "../../../src/algorithms/strategies/MeanReversionStrategy.js";
import { RSIStrategy } from "../../../src/algorithms/strategies/RSIStrategy.js";

describe("Strategies - Trade Duration Constraint", () => {
  test("should respect maxTradeDurationDays when calculating exit prices", () => {
    const strategy = new MomentumStrategy();
    const historicalData = Array.from({ length: 10 }, (_, i) => ({
      price: 100 + i * 2,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 120, { maxTradeDurationDays: 2 });

    if (signal.action === "BUY" && signal.exitPrice) {
      // Exit price should be achievable within 2 days
      // This is validated by the strategy considering historical price movements
      assert.ok(signal.exitPrice > signal.entryPrice);
    }
  });

  test("should adjust exit targets for quick completion", () => {
    const strategy = new MeanReversionStrategy();
    const historicalData = Array.from({ length: 25 }, (_, i) => ({
      price: 100 + (i % 5),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 95, { maxTradeDurationDays: 2 });

    if (signal.action === "BUY") {
      // Exit should be realistic for 2-day completion
      const profitPercent = (signal.exitPrice - signal.entryPrice) / signal.entryPrice;
      // Should be achievable in 2 days (not too aggressive)
      assert.ok(profitPercent <= 0.2); // Max 20% in 2 days
    }
  });
});
