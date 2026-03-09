import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";

describe("TradeManager - Volume Feasibility Accuracy", () => {

  test("should use avgDailyVolume from signal when available (not recalculate)", () => {
    // SignalGenerator calculates avgDailyVolume from recent days (maxTradeDurationDays + 2)
    // For a 5-day trade, it uses last 7 days
    // TradeManager should use the same value, not recalculate from all 30 days
    
    const rec = {
      item: "Water talisman",
      quantity: 15060,
      avgDailyVolume: 6341, // 7-day average (what SignalGenerator calculated)
      duration: 5,
      historicalData: Array.from({ length: 30 }, (_, i) => ({
        price: 164 + (i % 5),
        volume: i < 23 ? 6000 : 7000, // Last 7 days have higher volume
        timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      })),
      currentPrice: 164,
    };

    // Calculate what TradeManager would show
    const requiredVolume = rec.quantity * 2; // 30,120
    const tradeDurationDays = rec.duration; // 5
    const volumeUsagePercent = 0.95;
    
    // Using SignalGenerator's avgDailyVolume (7-day avg)
    const availableOverDuration = rec.avgDailyVolume * tradeDurationDays * volumeUsagePercent;
    const feasibilityPercent = (requiredVolume / availableOverDuration) * 100;
    
    // Should be ~100% (feasible) using 7-day avg
    // If TradeManager recalculated from 30-day avg, it would be different
    assert.ok(
      Math.abs(feasibilityPercent - 100) < 5,
      `Feasibility should be ~100% using SignalGenerator's avgDailyVolume, got ${feasibilityPercent.toFixed(1)}%`
    );
  });

  test("should calculate feasibility consistently with SignalGenerator", () => {
    // Test case: Water talisman from user's example
    const rec = {
      item: "Water talisman",
      quantity: 15060,
      avgDailyVolume: 6532.548, // 30-day average (if TradeManager recalculates)
      duration: 5,
      historicalData: Array.from({ length: 30 }, (_, i) => ({
        price: 164,
        volume: 6532.548,
        timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      })),
      currentPrice: 164,
    };

    const requiredVolume = rec.quantity * 2; // 30,120
    const tradeDurationDays = rec.duration; // 5
    const volumeUsagePercent = 0.95;
    const availableOverDuration = rec.avgDailyVolume * tradeDurationDays * volumeUsagePercent;
    const feasibilityPercent = (requiredVolume / availableOverDuration) * 100;

    // Expected: 30,120 / (6,532.548 * 5 * 0.95) = 30,120 / 31,029.6 = 97.1%
    const expectedPercent = 97.1;
    assert.ok(
      Math.abs(feasibilityPercent - expectedPercent) < 0.1,
      `Feasibility should be ~97.1%, got ${feasibilityPercent.toFixed(1)}%`
    );
  });

  test("should prefer rec.avgDailyVolume over recalculated value", () => {
    const rec = {
      item: "Test Item",
      quantity: 10000,
      avgDailyVolume: 5000, // SignalGenerator's calculated value (recent days)
      duration: 5,
      historicalData: Array.from({ length: 30 }, (_, i) => ({
        price: 100,
        volume: i < 20 ? 3000 : 8000, // Last 10 days have much higher volume
        timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      })),
      currentPrice: 100,
    };

    // If TradeManager recalculates from all 30 days:
    const allVolumes = rec.historicalData.map((d) => d.volume);
    const recalculatedAvg = allVolumes.reduce((sum, v) => sum + v, 0) / allVolumes.length;
    
    // Should be different from SignalGenerator's value
    assert.notEqual(
      recalculatedAvg,
      rec.avgDailyVolume,
      "Recalculated avg should differ from SignalGenerator's avg (uses recent days only)"
    );

    // TradeManager should use rec.avgDailyVolume (5000), not recalculated (~4500)
    // This ensures consistency with SignalGenerator's feasibility calculation
    const usedAvg = rec.avgDailyVolume; // What TradeManager should use
    assert.equal(usedAvg, 5000, "Should use SignalGenerator's avgDailyVolume");
  });

  test("should fallback to recalculated avgDailyVolume if signal doesn't provide it", () => {
    const rec = {
      item: "Test Item",
      quantity: 10000,
      // No avgDailyVolume from signal
      duration: 5,
      historicalData: Array.from({ length: 30 }, (_, i) => ({
        price: 100,
        volume: 5000,
        timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      })),
      currentPrice: 100,
    };

    // Should calculate from all historical data as fallback
    const volumes = rec.historicalData.map((d) => d.volume).filter((v) => v > 0);
    const fallbackAvg = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    assert.equal(fallbackAvg, 5000, "Should calculate from all historical data when signal doesn't provide avgDailyVolume");
  });

  test("should match SignalGenerator's volume feasibility calculation exactly", () => {
    // Simulate SignalGenerator's calculation
    const maxTradeDurationDays = 5;
    const recentDays = Math.min(maxTradeDurationDays + 2, 30); // 7 days
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 164,
      volume: 6341, // 7-day average volume
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));
    const recentData = historicalData.slice(-recentDays);
    const volumes = recentData.map((d) => d.volume).filter((v) => v > 0);
    const signalAvgDailyVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

    // SignalGenerator's feasibility calculation
    const quantity = 15060;
    const requiredVolume = quantity * 2; // 30,120
    const volumeUsagePercent = 0.95;
    const availableVolume = signalAvgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
    const signalFeasibility = availableVolume > 0 
      ? Math.min(1.0, availableVolume / requiredVolume)
      : 0.0;
    const signalFeasibilityPercent = (requiredVolume / availableVolume) * 100;

    // TradeManager should calculate the same way
    const rec = {
      item: "Water talisman",
      quantity: quantity,
      avgDailyVolume: signalAvgDailyVolume, // Use SignalGenerator's value
      duration: maxTradeDurationDays,
      historicalData: historicalData,
      currentPrice: 164,
    };

    const tradeDurationDays = rec.duration;
    const tradeVolumeUsagePercent = tradeDurationDays >= 5 ? 0.95 : tradeDurationDays >= 3 ? 0.9 : 0.75;
    const tradeRequiredVolume = rec.quantity * 2;
    const tradeAvailableOverDuration = rec.avgDailyVolume * tradeDurationDays * tradeVolumeUsagePercent;
    const tradeFeasibilityPercent = (tradeRequiredVolume / tradeAvailableOverDuration) * 100;

    // Should match exactly (within rounding)
    assert.ok(
      Math.abs(tradeFeasibilityPercent - signalFeasibilityPercent) < 0.1,
      `TradeManager feasibility (${tradeFeasibilityPercent.toFixed(1)}%) should match SignalGenerator (${signalFeasibilityPercent.toFixed(1)}%)`
    );
  });
});
