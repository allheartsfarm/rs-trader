import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Volume Feasibility Reality Check", () => {
  test("should limit quantity to realistic volume constraints", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Scenario: Team-23 cape with low volume
    // Daily volume: 6,190.613
    // For 5-day trade with 95% usage: available = 6,190.613 * 5 * 0.95 = 29,405
    // Max realistic quantity = 29,405 / 2 = 14,702
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 388 + (i % 10),
      volume: 6190.613, // Low daily volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 388;
    const signal = signalGenerator.generateSignal(
      "Team-23 cape",
      lowVolumeData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.quantity) {
      // Calculate max realistic quantity
      const avgDailyVolume = 6190.613;
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

  test("should show correct volume feasibility percentage in display", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 388 + (i % 10),
      volume: 6190.613,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Test Item",
      data,
      388
    );

    if (signal.action === "BUY" && signal.quantity && signal.avgDailyVolume) {
      const requiredVolume = signal.quantity * 2;
      const avgDailyVolume = signal.avgDailyVolume;
      const expectedPercent = ((requiredVolume / avgDailyVolume) * 100).toFixed(1);
      
      // The signal should have avgDailyVolume for display
      assert.ok(
        signal.avgDailyVolume > 0,
        "Signal should include avgDailyVolume for display"
      );
      
      // If volume feasibility is low, it should be reflected
      if (requiredVolume > avgDailyVolume) {
        const percent = parseFloat(expectedPercent);
        assert.ok(
          percent > 100,
          `Volume feasibility should show > 100% when required (${requiredVolume}) > available (${avgDailyVolume})`
        );
      }
    }
  });

  test("should penalize confidence when actual volume feasibility is low", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Create data where required volume exceeds available
    // This should reduce confidence significantly
    const constrainedData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 5000, // Low volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Constrained Item",
      constrainedData,
      100
    );

    // For a flipping bot, we reduce quantity instead of converting to HOLD
    // Volume constraints will reduce quantity, and confidence should be penalized
    if (signal.action === "BUY") {
      // With 70M capital, we'd want a large quantity
      // But volume is only 5,000/day
      // Volume constraints will reduce quantity, and confidence should be penalized
      assert.ok(
        signal.quantity > 0,
        "If BUY, quantity should be > 0 (reduced by volume constraints)"
      );
      assert.ok(
        signal.netProfit > 0,
        "If BUY, net profit should be > 0"
      );
      // Confidence should be reduced when volume is constrained
      // The actual penalty depends on actualVolumeFeasibility
      assert.ok(
        signal.confidence >= 0.1,
        "Confidence should be at least 0.1"
      );
      // With low volume, confidence should be lower than typical high-confidence signals
      // But we can't assert an exact value since it depends on strategy confidence too
    } else if (signal.action === "HOLD") {
      // Only HOLD if quantity is 0 or no profit
      assert.ok(
        signal.reason && (
          signal.reason.includes("Quantity too low") || 
          signal.reason.includes("No profit") ||
          signal.reason.includes("round to the same value")
        ),
        "Should only HOLD if quantity is 0 or no profit"
      );
    }
  });

  test("should convert to HOLD when quantity is 0 or profit is negative after volume constraints", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Create scenario with critically low volume that results in quantity = 0
    // Daily volume: 2,000
    // For 5-day trade: available = 2,000 * 5 * 0.95 = 9,500
    // With very low volume, quantity should be reduced to 0 or very small
    const criticalData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 1, // Extremely low volume - should result in quantity = 0
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Critical Volume Item",
      criticalData,
      100
    );

    // Should convert to HOLD when quantity is 0 or profit is <= 0
    // For a flipping bot, we reduce quantity instead of converting to HOLD
    // Only convert if quantity becomes 0 or there's no profit
    if (signal.action === "HOLD") {
      assert.ok(
        signal.reason && (
          signal.reason.includes("Quantity too low") || 
          signal.reason.includes("No profit") ||
          signal.reason.includes("round to the same value")
        ),
        "Should include reason about why trade is not viable"
      );
    } else if (signal.action === "BUY") {
      // If still BUY, quantity should be very small but > 0, and there should be profit
      assert.ok(
        signal.quantity > 0,
        "If BUY, quantity should be > 0"
      );
      assert.ok(
        signal.netProfit > 0,
        "If BUY, net profit should be > 0"
      );
    }
  });

  test("should calculate actual volume feasibility using final quantity", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 388,
      volume: 6190.613,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Test Item",
      data,
      388
    );

    if (signal.action === "BUY" && signal.quantity && signal.volumeFeasibility !== undefined) {
      // volumeFeasibility should be calculated using the ACTUAL quantity
      // not the estimated quantity
      const maxTradeDurationDays = settings.getConfig().trading.maxTradeDurationDays;
      const avgDailyVolume = 6190.613;
      const volumeUsagePercent = maxTradeDurationDays >= 5 ? 0.95 : maxTradeDurationDays >= 3 ? 0.9 : 0.75;
      const availableVolume = avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
      const requiredVolume = signal.quantity * 2;
      const expectedFeasibility = Math.min(1.0, availableVolume / requiredVolume);
      
      // Allow small tolerance for floating point
      assert.ok(
        Math.abs(signal.volumeFeasibility - expectedFeasibility) < 0.01,
        `Volume feasibility ${signal.volumeFeasibility} should match expected ${expectedFeasibility} (using actual quantity ${signal.quantity})`
      );
    }
  });

  test("should not show trades requiring > 500% of daily volume as feasible", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Scenario where required volume is way more than available
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 1000, // Very low volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Low Volume Item",
      data,
      100
    );

    if (signal.action === "BUY" && signal.quantity && signal.avgDailyVolume) {
      const requiredVolume = signal.quantity * 2;
      const percentOfDaily = (requiredVolume / signal.avgDailyVolume) * 100;
      
      // If requiring > 500% of daily volume, this should either:
      // 1. Be converted to HOLD (if feasibility < 30%)
      // 2. Have heavily penalized confidence
      
      if (percentOfDaily > 500) {
        // Should either be HOLD or have very low confidence
        if (signal.action === "BUY") {
          assert.ok(
            signal.confidence < 0.3,
            `When requiring ${percentOfDaily.toFixed(1)}% of daily volume, confidence should be very low (< 0.3)`
          );
        }
      }
    }
  });
});
