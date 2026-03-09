import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Benefits", () => {
  test("should include 'Highest Confidence' benefit when confidence >= 85%", async () => {
    const settings = new Settings();
    const generator = new SignalGenerator(settings);

    // Create historical data that will generate high confidence signals
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 - i * 2, // Decreasing price - should trigger mean reversion
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 10000,
    }));

    const currentPrice = 50; // Well below average - should trigger multiple strategies

    const signal = generator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.confidence >= 0.85) {
      assert.ok(signal.benefits, "Signal should have benefits property");
      assert.ok(
        signal.benefits.includes("Highest Confidence"),
        `Benefits should include 'Highest Confidence' for confidence ${(
          signal.confidence * 100
        ).toFixed(1)}%, got: ${signal.benefits}`
      );
    }
  });

  test("should NOT include 'Highest Confidence' benefit when confidence < 85%", async () => {
    const settings = new Settings();
    const generator = new SignalGenerator(settings);

    // Create historical data that will generate lower confidence signals
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5), // Small variations - less clear signal
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 1000,
    }));

    const currentPrice = 102; // Near average - less clear signal

    const signal = generator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.confidence < 0.85) {
      if (signal.benefits) {
        assert.ok(
          !signal.benefits.includes("Highest Confidence"),
          `Benefits should NOT include 'Highest Confidence' for confidence ${(
            signal.confidence * 100
          ).toFixed(1)}%, got: ${signal.benefits}`
        );
      }
    }
  });

  test("should NOT include 'Most Strategies Matched' benefit (removed)", async () => {
    const settings = new Settings();
    const generator = new SignalGenerator(settings);

    // Create data that triggers multiple strategies
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 - i * 1.5, // Decreasing price
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 10000,
    }));

    const currentPrice = 60; // Well below average

    const signal = generator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY") {
      // Check that "Most Strategies Matched" is NOT included (removed benefit)
      if (signal.benefits) {
        const benefitsStr = Array.isArray(signal.benefits)
          ? signal.benefits.join(", ")
          : signal.benefits;
        assert.ok(
          !benefitsStr.includes("Most Strategies Matched"),
          `Benefits should NOT include 'Most Strategies Matched' (removed), got: ${benefitsStr}`
        );
      }
    }
  });

  test("should include 'Quick' benefit for 1-day trades with high confidence", async () => {
    const settings = new Settings();
    await settings.load();

    // Temporarily set maxTradeDurationDays to 1
    const originalDuration = settings.getConfig().trading.maxTradeDurationDays;
    settings.getConfig().trading.maxTradeDurationDays = 1;

    const generator = new SignalGenerator(settings);

    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 - i * 2,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 10000,
    }));

    const currentPrice = 50;

    const signal = generator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.confidence >= 0.75) {
      assert.ok(signal.benefits, "Signal should have benefits property");
      assert.ok(
        signal.benefits.includes("Quick"),
        `Benefits should include 'Quick' for 1-day trade with confidence ${(
          signal.confidence * 100
        ).toFixed(1)}%, got: ${signal.benefits}`
      );
    }

    // Restore original duration
    settings.getConfig().trading.maxTradeDurationDays = originalDuration;
  });

  test("should NOT include 'Highest Profit Per Month' benefit in SignalGenerator (calculated in TradingBot)", async () => {
    const settings = new Settings();
    await settings.load();
    const generator = new SignalGenerator(settings);

    // SignalGenerator should NOT award "Highest" - that's done in TradingBot after comparing all
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 - i * 2,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 50000,
    }));

    const currentPrice = 50;
    const signal = generator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.benefits) {
      // SignalGenerator should not award "Highest" - only TradingBot can do that after comparing
      assert.ok(
        !signal.benefits.includes("Highest Profit Per Month"),
        "SignalGenerator should not award 'Highest Profit Per Month' - that's calculated in TradingBot"
      );
    }
  });
});

// Helper function for formatting (same as in formatGP.js)
function formatGP(amount) {
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  } else if (amount >= 1000) {
    const thousands = amount / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
  } else {
    return Math.floor(amount).toString();
  }
}
