import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Volume Constraint with Real Data Scenario", () => {
  test("should limit Team-23 cape quantity to realistic volume", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Real scenario: Team-23 cape
    // Daily volume: 6,190.613
    // For 5-day trade with 95% usage: available = 6,190.613 * 5 * 0.95 = 29,405
    // Max realistic quantity = 29,405 / 2 = 14,702
    const team23Data = Array.from({ length: 30 }, (_, i) => ({
      price: 388 + (i % 10),
      volume: 6190.613, // Real daily volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Team-23 cape",
      team23Data,
      388
    );

    if (signal.action === "BUY" && signal.quantity) {
      // Calculate expected max quantity
      const avgDailyVolume = 6190.613;
      const maxTradeDurationDays = settings.getConfig().trading.maxTradeDurationDays;
      const volumeUsagePercent = maxTradeDurationDays >= 5 ? 0.95 : maxTradeDurationDays >= 3 ? 0.9 : 0.75;
      const availableVolume = avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
      const maxRealisticQty = Math.floor(availableVolume / 2);
      
      assert.ok(
        signal.quantity <= maxRealisticQty,
        `Quantity ${signal.quantity} should not exceed realistic volume limit ${maxRealisticQty} (available: ${availableVolume}, required: ${signal.quantity * 2})`
      );
      
      // Also verify volume feasibility percentage
      if (signal.avgDailyVolume) {
        const requiredVolume = signal.quantity * 2;
        const percentOfDaily = (requiredVolume / signal.avgDailyVolume) * 100;
        
        // If quantity is properly limited, it should be <= 100% of daily volume needed
        // (or at least not 568%!)
        if (percentOfDaily > 200) {
          assert.fail(
            `Volume feasibility ${percentOfDaily.toFixed(1)}% is too high. Quantity ${signal.quantity} should be limited to max ${maxRealisticQty}`
          );
        }
      }
    }
  });

  test("should limit Amethyst dart tip quantity to realistic volume", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Real scenario: Amethyst dart tip
    // Daily volume: 6,348.29
    // For 5-day trade: available = 6,348.29 * 5 * 0.95 = 30,154
    // Max realistic quantity = 30,154 / 2 = 15,077
    // But we're seeing 21,353 which is way too high
    const amethystData = Array.from({ length: 30 }, (_, i) => ({
      price: 460 + (i % 10),
      volume: 6348.29,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Amethyst dart tip",
      amethystData,
      460
    );

    if (signal.action === "BUY" && signal.quantity) {
      const avgDailyVolume = 6348.29;
      const maxTradeDurationDays = settings.getConfig().trading.maxTradeDurationDays;
      const volumeUsagePercent = maxTradeDurationDays >= 5 ? 0.95 : maxTradeDurationDays >= 3 ? 0.9 : 0.75;
      const availableVolume = avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
      const maxRealisticQty = Math.floor(availableVolume / 2);
      
      assert.ok(
        signal.quantity <= maxRealisticQty,
        `Quantity ${signal.quantity} should not exceed realistic volume limit ${maxRealisticQty}`
      );
    }
  });
});
