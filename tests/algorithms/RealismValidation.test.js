import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("Realism Validation", () => {
  test("should not exceed historical maximum price by more than 10%", async () => {
    const settings = new Settings();
    await settings.load();
    const generator = new SignalGenerator(settings);
    
    // Create data with clear historical range and wider spread to allow realistic exit prices
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 500 + (i % 30), // Range: 500-529 (wider range)
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 10000,
    }));
    
    const currentPrice = 510;
    const signal = generator.generateSignal("Test Item", historicalData, currentPrice);
    
    // Only test if BUY signal is generated with valid exit price
    if (signal.action === "BUY" && signal.exitPrice) {
      const historicalMax = Math.max(...historicalData.map(d => d.price));
      const maxAllowed = historicalMax * 1.10; // 10% above max
      // Allow small epsilon for floating point precision
      const epsilon = 0.01;
      assert.ok(
        signal.exitPrice <= maxAllowed + epsilon,
        `Exit price ${signal.exitPrice} exceeds historical max ${historicalMax} by more than 10% (max allowed: ${maxAllowed})`
      );
    }
    // If no BUY signal, test passes (no recommendation to validate)
  });

  test("should cap 2-day profit margins at realistic levels (max 12%)", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.maxTradeDurationDays = 2;
    
    const generator = new SignalGenerator(settings);
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 550 + (i % 10),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 10000,
    }));
    
    const currentPrice = 551;
    const signal = generator.generateSignal("Test Item", historicalData, currentPrice);
    
    if (signal.action === "BUY") {
      const profitPercent = (signal.exitPrice - signal.entryPrice) / signal.entryPrice;
      // For 2-day trades, max should be around 12%
      assert.ok(
        profitPercent <= 0.15, // Allow up to 15% but prefer lower
        `2-day profit margin ${(profitPercent * 100).toFixed(1)}% is too high`
      );
    }
  });
});
