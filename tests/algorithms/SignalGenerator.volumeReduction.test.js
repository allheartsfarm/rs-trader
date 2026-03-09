import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Volume Reduction for 100% Usage", () => {
  test("should reduce quantity when it would use 100% of volume", () => {
    const settings = new Settings();
    settings.getConfig(); // Initialize config with defaults
    settings.config.trading.baseCapital = 70000000; // 70M
    settings.config.trading.maxTradeDurationDays = 5;
    
    const signalGenerator = new SignalGenerator(settings);
    
    // Create data for an item where desired quantity would use 100% of volume
    // But we want to reduce it to use only 70% while maintaining 5%+ profit margin
    const avgDailyVolume = 7000; // 7k per day
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 500, // 500 gp
      volume: avgDailyVolume,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));
    
    // Entry: 500, Exit: 550 (10% profit, 7.96% after fees)
    // Desired quantity might be high, but should be reduced to use max 70% of volume
    const signal = signalGenerator.generateSignal(
      "Test Item",
      data,
      500 // Current price
    );
    
    // Ensure we got a BUY signal
    assert.ok(
      signal.action === "BUY",
      `Expected BUY signal, got ${signal.action}. Reason: ${signal.reason || "none"}`
    );
    assert.ok(
      signal.quantity > 0,
      `Expected quantity > 0, got ${signal.quantity}`
    );
    
    if (signal.action === "BUY" && signal.quantity > 0) {
      // Calculate what volume this quantity would use
      const requiredVolume = signal.quantity * 2; // Buy + sell
      const volumeUsagePercent = 0.7; // 70% for 5-day trades
      const availableVolume = avgDailyVolume * 5 * volumeUsagePercent; // 5 days * 70%
      const feasibilityPercent = (requiredVolume / availableVolume) * 100;
      
      // Should use <= 70% of safe volume (which is 70% of actual volume)
      // So feasibility should be <= 100% of the 70% safe volume
      assert.ok(
        feasibilityPercent <= 100,
        `Quantity should use <= 100% of safe volume (70% of actual). Got ${feasibilityPercent.toFixed(1)}%`
      );
      
      // Verify trade is still profitable (profit margin percentage doesn't change with quantity)
      const totalCost = signal.entryPrice * signal.quantity * 1.02;
      const netProfit = (signal.exitPrice * 0.98 - signal.entryPrice * 1.02) * signal.quantity;
      const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      
      assert.ok(
        netProfit > 0,
        `Trade should still be profitable after volume reduction. Got ${netProfit.toLocaleString()} gp profit (${profitPercent.toFixed(2)}%)`
      );
    }
  });
  
  test("should maintain profit margin when reducing quantity", () => {
    const settings = new Settings();
    settings.getConfig(); // Initialize config with defaults
    settings.config.trading.baseCapital = 70000000;
    settings.config.trading.maxTradeDurationDays = 5;
    
    const signalGenerator = new SignalGenerator(settings);
    
    // Item with limited volume but good profit margin
    const avgDailyVolume = 5000; // 5k per day
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 310, // 310 gp (like Team-19 cape)
      volume: avgDailyVolume,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));
    
    const signal = signalGenerator.generateSignal(
      "Team-19 cape",
      data,
      310
    );
    
    // Ensure we got a BUY signal
    assert.ok(
      signal.action === "BUY",
      `Expected BUY signal, got ${signal.action}. Reason: ${signal.reason || "none"}`
    );
    assert.ok(
      signal.quantity > 0,
      `Expected quantity > 0, got ${signal.quantity}`
    );
    
    if (signal.action === "BUY" && signal.quantity > 0) {
      // Calculate volume usage
      const requiredVolume = signal.quantity * 2;
      const availableVolume = avgDailyVolume * 5 * 0.7; // 70% of 5-day volume
      const feasibilityPercent = (requiredVolume / availableVolume) * 100;
      
      // Should not exceed 100% of safe volume
      assert.ok(
        feasibilityPercent <= 100,
        `Should use <= 100% of safe volume. Got ${feasibilityPercent.toFixed(1)}%`
      );
      
      // Trade should still be profitable (profit margin percentage doesn't change with quantity)
      const totalCost = signal.entryPrice * signal.quantity * 1.02;
      const netProfit = (signal.exitPrice * 0.98 - signal.entryPrice * 1.02) * signal.quantity;
      const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      
      // Should still be profitable
      assert.ok(
        netProfit > 0,
        `Trade should still be profitable after volume reduction. Got ${netProfit.toLocaleString()} gp profit (${profitPercent.toFixed(2)}%)`
      );
    }
  });
});
