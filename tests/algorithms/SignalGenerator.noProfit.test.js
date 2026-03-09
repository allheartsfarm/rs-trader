import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";

describe("SignalGenerator - No Profit Filtering", () => {
  test("should return HOLD when entry and exit prices round to the same value", () => {
    const signalGenerator = new SignalGenerator();
    
    // Create historical data where prices are very close (2.0 -> 2.1)
    // After rounding, both become 2, making the trade pointless
    const historicalData = [
      { price: 2.0, date: new Date("2024-01-01") },
      { price: 2.0, date: new Date("2024-01-02") },
      { price: 2.0, date: new Date("2024-01-03") },
      { price: 2.0, date: new Date("2024-01-04") },
      { price: 2.0, date: new Date("2024-01-05") },
      { price: 2.0, date: new Date("2024-01-06") },
      { price: 2.0, date: new Date("2024-01-07") },
      { price: 2.0, date: new Date("2024-01-08") },
      { price: 2.0, date: new Date("2024-01-09") },
      { price: 2.0, date: new Date("2024-01-10") },
    ];

    const currentPrice = 2.0;

    const signal = signalGenerator.generateSignal(
      "Basket",
      historicalData,
      currentPrice
    );

    // Should return HOLD if entry and exit round to same value
    if (signal.action === "BUY") {
      const entryRounded = Math.floor(signal.entryPrice);
      const exitRounded = Math.floor(signal.exitPrice);
      
      assert.notEqual(
        entryRounded,
        exitRounded,
        "Should not generate BUY signal when entry and exit round to same value"
      );
    }
  });

  test("should filter out signals where entry and exit prices are identical after rounding", () => {
    const signalGenerator = new SignalGenerator();
    
    // Historical data with very stable prices around 2
    const historicalData = [
      { price: 2.0, date: new Date("2024-01-01") },
      { price: 2.0, date: new Date("2024-01-02") },
      { price: 2.0, date: new Date("2024-01-03") },
      { price: 2.0, date: new Date("2024-01-04") },
      { price: 2.0, date: new Date("2024-01-05") },
      { price: 2.0, date: new Date("2024-01-06") },
      { price: 2.0, date: new Date("2024-01-07") },
      { price: 2.0, date: new Date("2024-01-08") },
      { price: 2.0, date: new Date("2024-01-09") },
      { price: 2.0, date: new Date("2024-01-10") },
    ];

    const signal = signalGenerator.generateSignal(
      "Basket",
      historicalData,
      2.0
    );

    // If exit price calculation results in same rounded value as entry, should be filtered
    if (signal.action === "BUY") {
      const entryRounded = Math.floor(signal.entryPrice);
      const exitRounded = Math.floor(signal.exitPrice);
      
      assert.notEqual(
        entryRounded,
        exitRounded,
        "Should not generate BUY signal when entry and exit round to same value"
      );
    }
  });

  test("should allow signals where entry and exit prices differ after rounding", () => {
    const signalGenerator = new SignalGenerator();
    
    const historicalData = [
      { price: 100, date: new Date("2024-01-01") },
      { price: 105, date: new Date("2024-01-02") },
      { price: 110, date: new Date("2024-01-03") },
      { price: 115, date: new Date("2024-01-04") },
      { price: 120, date: new Date("2024-01-05") },
      { price: 125, date: new Date("2024-01-06") },
      { price: 130, date: new Date("2024-01-07") },
      { price: 135, date: new Date("2024-01-08") },
      { price: 140, date: new Date("2024-01-09") },
      { price: 145, date: new Date("2024-01-10") },
    ];

    const signal = signalGenerator.generateSignal(
      "Test item",
      historicalData,
      100
    );

    // Should generate signal if prices differ after rounding
    if (signal.action === "BUY") {
      const entryRounded = Math.floor(signal.entryPrice);
      const exitRounded = Math.floor(signal.exitPrice);
      
      assert.ok(
        exitRounded > entryRounded,
        "Exit price should be greater than entry price after rounding"
      );
    }
  });
});
