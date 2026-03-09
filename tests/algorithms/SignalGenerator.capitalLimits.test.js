import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Capital Limits", () => {
  test("should return HOLD if single unit exceeds capital", async () => {
    const settings = new Settings();
    await settings.load();
    // Set capital to 70M
    settings.config.trading.baseCapital = 70000000;
    settings.config.trading.positionSizePercent = 0.33;
    // Max position size = 70M * 0.33 = 23.1M
    
    const signalGenerator = new SignalGenerator(settings);
    
    // Create data for a very expensive item (110M entry price)
    // Single unit cost = 110M * 1.02 = 112.2M (exceeds 23.1M limit)
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 110000000, // 110M gp
      volume: 1000,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));
    
    const signal = signalGenerator.generateSignal(
      "Ancestral robe bottom",
      data,
      110000000
    );
    
    // Should return HOLD because even 1 unit exceeds capital
    assert.strictEqual(
      signal.action,
      "HOLD",
      "Should return HOLD when single unit exceeds capital"
    );
    assert.ok(
      signal.reason && signal.reason.includes("exceeds available capital"),
      "Reason should mention capital limit"
    );
  });

  test("should allow trade if quantity respects capital limits", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.baseCapital = 70000000;
    settings.config.trading.positionSizePercent = 0.33;
    // Max position size = 70M * 0.33 = 23.1M
    
    const signalGenerator = new SignalGenerator(settings);
    
    // Create data for an affordable item (10M entry price)
    // Max quantity = floor(23.1M / 10M) = 2 units
    // 2 units * 10M * 1.02 = 20.4M (within 23.1M limit)
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 10000000, // 10M gp
      volume: 10000,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));
    
    const signal = signalGenerator.generateSignal(
      "Affordable Item",
      data,
      10000000
    );
    
    if (signal.action === "BUY") {
      const totalCost = signal.entryPrice * signal.quantity * 1.02; // Entry + fee
      const maxPositionSize = 70000000 * 0.33;
      
      assert.ok(
        totalCost <= maxPositionSize,
        `Trade cost ${totalCost.toLocaleString()} should not exceed capital limit ${maxPositionSize.toLocaleString()}`
      );
    }
  });

  test("should return quantity 0 if single unit exceeds capital in calculateQuantity", async () => {
    const settings = new Settings();
    await settings.load();
    settings.config.trading.baseCapital = 70000000;
    settings.config.trading.positionSizePercent = 0.33;
    
    const signalGenerator = new SignalGenerator(settings);
    
    // Test with entry price that exceeds capital for single unit
    const entryPrice = 110000000; // 110M
    const exitPrice = 120000000; // 120M
    const maxPositionSize = 70000000 * 0.33; // 23.1M
    const singleUnitCost = entryPrice * 1.02; // 112.2M
    
    assert.ok(
      singleUnitCost > maxPositionSize,
      "Single unit should exceed capital for this test"
    );
    
    const quantity = signalGenerator.calculateQuantity(
      entryPrice,
      exitPrice,
      0.8,
      [],
      false // Don't apply volume constraints for this test
    );
    
    assert.strictEqual(
      quantity,
      0,
      "Should return 0 quantity when single unit exceeds capital"
    );
  });
});
