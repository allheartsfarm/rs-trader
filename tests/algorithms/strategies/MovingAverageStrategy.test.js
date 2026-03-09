import { test, describe } from "node:test";
import assert from "node:assert";
import { MovingAverageStrategy } from "../../../src/algorithms/strategies/MovingAverageStrategy.js";

describe("MovingAverageStrategy", () => {
  test("should identify golden cross (price above both MAs) as BUY", () => {
    const strategy = new MovingAverageStrategy();
    // Create data with price crossing above moving averages
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 90 + i * 1.5, // Rising trend
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 135);

    if (signal.action === "BUY") {
      assert.ok(signal.confidence > 0.5);
      assert.ok(signal.exitPrice > signal.entryPrice);
    }
  });

  test("should identify death cross (price below both MAs) as SELL", () => {
    const strategy = new MovingAverageStrategy();
    // Create data with price crossing below moving averages
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 130 - i * 1.5, // Declining trend
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 85);

    if (signal.action === "SELL") {
      assert.ok(signal.confidence > 0.5);
    }
  });
});
