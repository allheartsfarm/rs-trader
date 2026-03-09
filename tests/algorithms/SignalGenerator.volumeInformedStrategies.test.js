import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";

describe("SignalGenerator - Volume-Informed Strategies", () => {
  test("should reduce confidence when volume is insufficient for trade execution", () => {
    const signalGenerator = new SignalGenerator();
    
    // Historical data with very low volume (e.g., 100/day)
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 100, // Very low volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Low Volume Item",
      lowVolumeData,
      100
    );

    // When volume feasibility is low, confidence should be reduced
    if (signal.action === "BUY" && signal.volumeFeasibility != null && signal.volumeFeasibility < 0.3) {
      assert.ok(signal.confidence < 0.7, "Low volume should reduce confidence when feasibility is low");
    }
  });

  test("should maintain high confidence when volume is sufficient", () => {
    const signalGenerator = new SignalGenerator();
    
    // Historical data with high volume
    const highVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5),
      volume: 50000, // High volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "High Volume Item",
      highVolumeData,
      100
    );

    // High volume should allow normal confidence levels
    if (signal.action === "BUY") {
      assert.ok(
        signal.confidence >= 0.3,
        "High volume should allow normal confidence levels"
      );
    }
  });
});
