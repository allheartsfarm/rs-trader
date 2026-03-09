import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - HOLD Explanation Consistency", () => {
  test("should generate HOLD explanation when signal is converted to HOLD due to no profit", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);

    // Create data that would generate a BUY signal but results in no profit after fees
    // This happens when entry and exit prices are very close
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 10000,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    // Use a price that results in no profit after fees
    // Entry: 100, Exit: 100 (after fees, net profit would be negative)
    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "No Profit Item",
      historicalData,
      currentPrice
    );

    // If converted to HOLD, explanation should not mention BUY
    if (signal.action === "HOLD") {
      assert.ok(
        !signal.explanation || !signal.explanation.includes("recommend BUY"),
        "HOLD explanation should not mention BUY recommendations"
      );
      assert.ok(
        signal.reason,
        "HOLD should have a reason explaining why it's HOLD"
      );
    }
  });

  test("should generate explanation that matches final action (BUY or HOLD)", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);

    // Create data that generates a valid BUY signal
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + i * 0.5, // Upward trend
      volume: 10000,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "Valid Buy Item",
      historicalData,
      currentPrice
    );

    // If action is BUY, explanation can mention BUY
    // If action is HOLD, explanation should not mention BUY
    if (signal.action === "BUY") {
      // BUY signals can mention strategies recommending BUY
      assert.ok(signal.explanation, "BUY signal should have explanation");
    } else if (signal.action === "HOLD") {
      // HOLD signals should not have explanations that mention BUY recommendations
      if (signal.explanation) {
        assert.ok(
          !signal.explanation.includes("recommend BUY") ||
            signal.explanation.includes("HOLD") ||
            signal.reason,
          "HOLD explanation should not contradict the HOLD action"
        );
      }
    }
  });

  test("should not show 'X of Y strategies recommend BUY' when action is HOLD", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);

    // Create scenario where strategies recommend BUY but signal is converted to HOLD
    // This happens when entry/exit prices round to same value or no profit
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 2, // Very low price that might round to same value
      volume: 10000,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 2;
    const signal = signalGenerator.generateSignal(
      "Rounded Price Item",
      historicalData,
      currentPrice
    );

    // If action is HOLD, explanation should not say "X of Y strategies recommend BUY"
    if (signal.action === "HOLD") {
      if (signal.explanation) {
        const hasBuyRecommendation = /(\d+)\s+of\s+(\d+)\s+strategies?\s+recommend\s+BUY/i.test(
          signal.explanation
        );
        assert.ok(
          !hasBuyRecommendation,
          "HOLD explanation should not mention strategies recommending BUY"
        );
      }
    }
  });
});
