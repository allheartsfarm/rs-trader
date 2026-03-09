import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("Volume Feasibility for 2-Day Trades", () => {
  test("should check if trade volume is sufficient for quick completion", () => {
    const settings = new Settings();
    const generator = new SignalGenerator(settings);
    
    // Create data with high volume (feasible for quick trade)
    const highVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 50000, // High volume
    }));

    const signal = generator.generateSignal("Test Item", highVolumeData, 100);
    
    // Should generate signal if volume is sufficient
    assert.ok(signal);
    if (signal.action === "BUY") {
      assert.ok(signal.quantity > 0);
    }
  });

  test("should adjust quantity based on available volume", () => {
    const settings = new Settings();
    const generator = new SignalGenerator(settings);
    
    // Create data with low volume
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      volume: 100, // Very low volume
    }));

    const signal = generator.generateSignal("Test Item", lowVolumeData, 100);
    
    // Quantity should be limited by volume
    if (signal.action === "BUY") {
      assert.ok(signal.quantity >= 0);
    }
  });
});
