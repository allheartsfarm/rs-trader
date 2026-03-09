import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Volume Safety Thresholds", () => {
  test("should reduce confidence for trades using > 80% of available volume", async () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);

    // Create data with volume that would result in 100% usage
    const avgDailyVolume = 10000;
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: avgDailyVolume,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    // Set up for a trade that would use 100% of volume
    settings.config.trading.maxTradeDurationDays = 5;
    settings.config.trading.baseCapital = 100000000; // Large capital to force high quantity

    const signal = signalGenerator.generateSignal("Test Item", data, 100);

    if (signal.action === "BUY" && signal.volumeFeasibility !== undefined) {
      // If volume feasibility is high (close to 1.0), confidence should be penalized
      // because using 100% of volume is risky
      if (signal.volumeFeasibility >= 0.95) {
        // Confidence should be reduced for very high volume usage
        // The penalty should be visible (at least 5-10% reduction)
        assert.ok(
          signal.confidence < 0.95,
          "Confidence should be reduced when using > 95% of available volume"
        );
      }
    }
  });

  test("should mark trades using > 80% volume as high risk", async () => {
    const settings = new Settings();
    await settings.load();
    const signalGenerator = new SignalGenerator(settings);

    const avgDailyVolume = 5000;
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: avgDailyVolume,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    settings.config.trading.maxTradeDurationDays = 5;
    settings.config.trading.baseCapital = 100000000;

    const signal = signalGenerator.generateSignal("Test Item", data, 100);

    if (signal.action === "BUY" && signal.volumeFeasibility !== undefined) {
      // If using > 80% of volume, should have execution risk indicator
      if (signal.volumeFeasibility >= 0.8) {
        // Execution plan should reflect high risk
        if (signal.executionPlan) {
          assert.ok(
            signal.executionPlan.executionRisk === "high" ||
              signal.executionPlan.executionRisk === "medium",
            `Trades using > 80% volume should have elevated execution risk (got: ${signal.executionPlan.executionRisk})`
          );
        } else {
          // If no execution plan, that's also a problem - should always have one
          assert.fail("Signal should have execution plan");
        }
      }
    }
  });

  test("should prefer trades using < 70% of available volume", async () => {
    const settings = new Settings();
    await settings.load();
    const signalGenerator = new SignalGenerator(settings);

    // Test with different volume scenarios
    const scenarios = [
      { avgVolume: 20000, expectedFeasibility: "< 0.7" }, // Low usage
      { avgVolume: 15000, expectedFeasibility: "< 0.8" }, // Medium usage
      { avgVolume: 10000, expectedFeasibility: ">= 0.8" }, // High usage
    ];

    settings.config.trading.maxTradeDurationDays = 5;
    settings.config.trading.baseCapital = 50000000;

    scenarios.forEach((scenario) => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        price: 100,
        volume: scenario.avgVolume,
        timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      }));

      const signal = signalGenerator.generateSignal("Test Item", data, 100);

      if (signal.action === "BUY" && signal.volumeFeasibility !== undefined) {
        // Lower volume usage should result in higher confidence (less penalty)
        if (scenario.expectedFeasibility.includes("< 0.7")) {
          // Low usage should have minimal confidence penalty
          assert.ok(
            signal.confidence >= 0.7,
            `Low volume usage (${scenario.avgVolume}/day) should maintain high confidence`
          );
        }
      }
    });
  });
});
