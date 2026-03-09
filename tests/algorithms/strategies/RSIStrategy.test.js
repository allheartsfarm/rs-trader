import { test, describe } from "node:test";
import assert from "node:assert";
import { RSIStrategy } from "../../../src/algorithms/strategies/RSIStrategy.js";

describe("RSIStrategy", () => {
  test("should identify oversold condition as BUY signal", () => {
    const strategy = new RSIStrategy();
    // Create data with declining prices (oversold)
    const historicalData = Array.from({ length: 15 }, (_, i) => ({
      price: 100 - i * 2, // Declining prices
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 70);

    assert.strictEqual(signal.action, "BUY");
    assert.ok(signal.confidence > 0.5);
  });

  test("should identify overbought condition as SELL signal", () => {
    const strategy = new RSIStrategy();
    // Create data with rising prices (overbought)
    const historicalData = Array.from({ length: 15 }, (_, i) => ({
      price: 100 + i * 2, // Rising prices
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 130);

    assert.strictEqual(signal.action, "SELL");
    assert.ok(signal.confidence > 0.5);
  });

  test("should return HOLD for neutral RSI", () => {
    const strategy = new RSIStrategy();
    // Create data with stable prices
    const historicalData = Array.from({ length: 15 }, (_, i) => ({
      price: 100 + (i % 3) - 1, // Stable around 100
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const signal = strategy.analyze(historicalData, 100);

    assert.strictEqual(signal.action, "HOLD");
  });
});
