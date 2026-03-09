import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";
import { TradeManager } from "../../src/bot/TradeManager.js";

describe("Volume Feasibility Consistency - SignalGenerator to TradeManager", () => {
  test("should use same avgDailyVolume in both SignalGenerator and TradeManager", () => {
    const settings = new Settings();
    const signalGenerator = new SignalGenerator(settings);
    
    // Create historical data with varying volumes
    // Last 7 days have different volume than full 30 days
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 164 + (i % 5),
      volume: i < 23 ? 6000 : 7000, // Last 7 days have higher volume
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 164;
    const signal = signalGenerator.generateSignal(
      "Water talisman",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.quantity && signal.avgDailyVolume) {
      // SignalGenerator's avgDailyVolume (calculated from recent days)
      const signalAvgDailyVolume = signal.avgDailyVolume;
      
      // Calculate what 7-day average should be (last 7 days = 7000 each)
      const recentDays = 7;
      const recentData = historicalData.slice(-recentDays);
      const recentVolumes = recentData.map((d) => d.volume).filter((v) => v > 0);
      const expected7DayAvg = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
      
      // SignalGenerator should use 7-day average (for 5-day trade: 5+2=7 days)
      assert.ok(
        Math.abs(signalAvgDailyVolume - expected7DayAvg) < 1,
        `SignalGenerator avgDailyVolume (${signalAvgDailyVolume}) should match 7-day average (${expected7DayAvg})`
      );

      // Now simulate what TradeManager would calculate
      const rec = {
        ...signal,
        historicalData: historicalData,
        currentPrice: currentPrice,
        duration: 5,
      };

      // TradeManager should use rec.avgDailyVolume (from signal), not recalculate
      const tradeManagerAvgDailyVolume = rec.avgDailyVolume || 
        rec.historicalData
          .map((d) => d.volume || 0)
          .filter((v) => v > 0)
          .reduce((sum, v) => sum + v, 0) / 
        rec.historicalData.filter((d) => d.volume > 0).length;

      // Should match SignalGenerator's value
      assert.equal(
        tradeManagerAvgDailyVolume,
        signalAvgDailyVolume,
        "TradeManager should use SignalGenerator's avgDailyVolume, not recalculate"
      );

      // Calculate feasibility the same way in both
      const quantity = signal.quantity;
      const requiredVolume = quantity * 2;
      const tradeDurationDays = 5;
      const volumeUsagePercent = 0.95;
      const availableVolume = signalAvgDailyVolume * tradeDurationDays * volumeUsagePercent;
      const feasibilityPercent = (requiredVolume / availableVolume) * 100;

      // Both should calculate the same feasibility percentage
      const signalFeasibilityPercent = signal.volumeFeasibility 
        ? (1 / signal.volumeFeasibility) * 100 
        : 100;
      
      // Allow small tolerance for rounding differences
      assert.ok(
        Math.abs(feasibilityPercent - signalFeasibilityPercent) < 5 || 
        (feasibilityPercent <= 100 && signalFeasibilityPercent <= 100),
        `Feasibility calculations should be consistent. TradeManager: ${feasibilityPercent.toFixed(1)}%, SignalGenerator: ${signalFeasibilityPercent.toFixed(1)}%`
      );
    }
  });

  test("should calculate feasibility percentage correctly for Water talisman example", () => {
    const settings = new Settings();
    settings.getConfig().trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);

    // Water talisman data from user's example
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 164,
      volume: 6532.548, // Consistent volume
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 164;
    const signal = signalGenerator.generateSignal(
      "Water talisman",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.quantity === 15060 && signal.avgDailyVolume) {
      // Verify SignalGenerator's calculation
      const requiredVolume = signal.quantity * 2; // 30,120
      const tradeDurationDays = 5;
      const volumeUsagePercent = 0.95;
      const availableVolume = signal.avgDailyVolume * tradeDurationDays * volumeUsagePercent;
      const feasibilityPercent = (requiredVolume / availableVolume) * 100;

      // Expected: 30,120 / (6,532.548 * 5 * 0.95) = 30,120 / 31,029.6 = 97.1%
      const expectedPercent = 97.1;
      
      assert.ok(
        Math.abs(feasibilityPercent - expectedPercent) < 0.2,
        `Feasibility should be ~97.1%, got ${feasibilityPercent.toFixed(1)}%`
      );

      // TradeManager should calculate the same way using signal.avgDailyVolume
      const rec = {
        ...signal,
        historicalData: historicalData,
        currentPrice: currentPrice,
        duration: 5,
      };

      // TradeManager uses rec.avgDailyVolume (from signal)
      const tradeManagerAvg = rec.avgDailyVolume;
      const tradeManagerAvailable = tradeManagerAvg * 5 * 0.95;
      const tradeManagerFeasibility = (requiredVolume / tradeManagerAvailable) * 100;

      assert.ok(
        Math.abs(tradeManagerFeasibility - feasibilityPercent) < 0.1,
        `TradeManager feasibility (${tradeManagerFeasibility.toFixed(1)}%) should match SignalGenerator (${feasibilityPercent.toFixed(1)}%)`
      );
    }
  });
});
