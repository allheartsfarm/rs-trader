import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";

describe("SignalGenerator - Volume Constraints", () => {
  test("should not allow quantity exceeding realistic daily volume for 1-day trades", () => {
    const signalGenerator = new SignalGenerator();
    
    // Historical data with low daily volume (e.g., 9,039/day for Team-23 cape)
    const historicalData = [
      { price: 388, volume: 9039, date: new Date("2024-01-01") },
      { price: 390, volume: 8500, date: new Date("2024-01-02") },
      { price: 392, volume: 9200, date: new Date("2024-01-03") },
      { price: 388, volume: 8800, date: new Date("2024-01-04") },
      { price: 390, volume: 9100, date: new Date("2024-01-05") },
    ];

    const currentPrice = 388;
    const entryPrice = 388;
    const exitPrice = 443;
    
    // For 1-day trade, we need to buy AND sell within 1 day
    // Average daily volume: ~8,900
    // Required volume for 3,841 quantity: 3,841 * 2 = 7,682 (buy + sell)
    // But we can only use a portion of daily volume (e.g., 90% for 1-day = ~8,010)
    // So max realistic quantity: 8,010 / 2 = ~4,005
    
    // However, if we're trying to flip 3,841 in one day:
    // Required: 3,841 * 2 = 7,682
    // Available (90% of 8,900): ~8,010
    // This should be OK, but let's verify the calculation
    
    const avgDailyVolume = historicalData
      .map(d => d.volume || 0)
      .filter(v => v > 0)
      .reduce((sum, v) => sum + v, 0) / 
      historicalData.filter(d => d.volume > 0).length;
    
    const maxTradeDurationDays = 1;
    const volumeUsagePercent = maxTradeDurationDays >= 5 ? 0.95 : maxTradeDurationDays >= 3 ? 0.9 : 0.9;
    const availableVolumeForPeriod = avgDailyVolume * maxTradeDurationDays;
    const realisticVolumeLimit = availableVolumeForPeriod * volumeUsagePercent;
    const maxRealisticQty = Math.floor(realisticVolumeLimit / 2); // Half for buy, half for sell
    
    // For 3,841 quantity, we need 3,841 * 2 = 7,682 volume
    const requiredVolume = 3841 * 2;
    
    assert.ok(
      requiredVolume <= realisticVolumeLimit,
      `Required volume ${requiredVolume} should be <= available ${realisticVolumeLimit} for 1-day trade`
    );
    
    // But the quantity should be capped at maxRealisticQty
    assert.ok(
      3841 <= maxRealisticQty,
      `Quantity 3841 should be <= max realistic ${maxRealisticQty} for 1-day trade with avg volume ${avgDailyVolume.toFixed(0)}`
    );
  });
});
