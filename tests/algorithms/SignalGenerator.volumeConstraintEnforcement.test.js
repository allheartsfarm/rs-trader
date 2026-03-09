import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Volume Constraint Enforcement", () => {
  test("should enforce volume constraint for Ardougne teleport scenario", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);
    
    // Real scenario: Ardougne teleport
    // Daily volume: 5,784.839
    // For 5-day trade: available = 5,784.839 * 5 * 0.95 = 27,478
    // Max realistic qty = 27,478 / 2 = 13,738
    // But we're seeing 14,261 which exceeds the limit
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 557 + (i % 10),
      volume: 5784.839,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Ardougne teleport (tablet)",
      data,
      557
    );

    if (signal.action === "BUY" && signal.quantity) {
      const avgDailyVolume = 5784.839;
      const maxTradeDurationDays = 5;
      const volumeUsagePercent = 0.95;
      const availableVolume = avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
      const maxRealisticQty = Math.floor(availableVolume / 2);
      
      assert.ok(
        signal.quantity <= maxRealisticQty,
        `Quantity ${signal.quantity} should not exceed realistic volume limit ${maxRealisticQty} (available: ${availableVolume}, required: ${signal.quantity * 2})`
      );
    }
  });

  test("should enforce volume constraint for Mithril pickaxe scenario", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);
    
    // Real scenario: Mithril pickaxe
    // Daily volume: 6,767.71
    // For 5-day trade: available = 6,767.71 * 5 * 0.95 = 32,147
    // Max realistic qty = 32,147 / 2 = 16,073
    // But we're seeing 18,473 which exceeds the limit
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 435 + (i % 10),
      volume: 6767.71,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Mithril pickaxe",
      data,
      435
    );

    if (signal.action === "BUY" && signal.quantity) {
      const avgDailyVolume = 6767.71;
      const maxTradeDurationDays = 5;
      const volumeUsagePercent = 0.95;
      const availableVolume = avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
      const maxRealisticQty = Math.floor(availableVolume / 2);
      
      assert.ok(
        signal.quantity <= maxRealisticQty,
        `Quantity ${signal.quantity} should not exceed realistic volume limit ${maxRealisticQty}`
      );
    }
  });
});
