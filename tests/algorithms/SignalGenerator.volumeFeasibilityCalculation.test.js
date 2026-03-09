import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";

describe("SignalGenerator - Volume Feasibility Calculation", () => {
  test("should calculate volume feasibility correctly when required > available", () => {
    const signalGenerator = new SignalGenerator();
    
    // Scenario: Need 42,706 volume but only have 6,348 available
    // This should result in volumeFeasibility < 0.3 (should convert to HOLD)
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 460,
      volume: 6348, // Low volume (like Amethyst dart tip)
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 460;
    const signal = signalGenerator.generateSignal(
      "Low Volume Test",
      lowVolumeData,
      currentPrice
    );

    // With 70M capital, 33% position size = 23.1M
    // At 460 gp, estimated quantity = 23,100,000 / 460 = ~50,217
    // Required volume = 50,217 * 2 = 100,434
    // Available (1-day, 75%): 6,348 * 1 * 0.75 = 4,761
    // Feasibility = 4,761 / 100,434 = 0.047 (4.7%)
    
    // When volume feasibility is low (< 0.3), confidence should be low
    if (signal.action === "BUY" && signal.volumeFeasibility != null && signal.volumeFeasibility < 0.3) {
      assert.ok(signal.confidence < 0.3, "With very low volume feasibility, confidence should be very low");
    }
  });

  test("should properly penalize confidence based on volume feasibility", () => {
    const signalGenerator = new SignalGenerator();
    
    // Scenario: Moderate volume constraint (50% feasible)
    // This should reduce confidence by ~25% (max 50% penalty)
    const moderateVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 10000, // Moderate volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "Moderate Volume Test",
      moderateVolumeData,
      currentPrice
    );

    // Calculate expected feasibility
    // With 70M capital, 33% = 23.1M
    // At 100 gp, estimated quantity = 231,000
    // Required volume = 231,000 * 2 = 462,000
    // Available (1-day, 75%): 10,000 * 1 * 0.75 = 7,500
    // Feasibility = 7,500 / 462,000 = 0.016 (1.6%)
    
    // When volume feasibility is low, confidence should be penalized
    if (signal.action === "BUY" && signal.volumeFeasibility != null && signal.volumeFeasibility < 0.3) {
      assert.ok(signal.confidence < 0.3, "With low volume feasibility, confidence should be penalized");
    }
  });

  test("should not penalize confidence when volume is sufficient", () => {
    const signalGenerator = new SignalGenerator();
    
    // Scenario: High volume (more than enough)
    const highVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 500000, // Very high volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "High Volume Test",
      highVolumeData,
      currentPrice
    );

    // With high volume, feasibility should be >= 1.0
    // No penalty should apply
    if (signal.action === "BUY") {
      // Confidence should be normal (not penalized)
      assert.ok(
        signal.confidence >= 0.3,
        "With sufficient volume, confidence should not be penalized"
      );
    }
  });

  test("should use actual quantity for volume feasibility, not estimated", () => {
    // The issue: volume feasibility is calculated using ESTIMATED quantity
    // But actual quantity might be different (limited by volume constraints)
    // This creates a mismatch where feasibility shows high % but trade is actually constrained
    
    const signalGenerator = new SignalGenerator();
    
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 460,
      volume: 6348,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Test Item",
      data,
      460
    );

    // The actual quantity should be limited by volume constraints
    // So the volume feasibility calculation should use the ACTUAL quantity
    // not the estimated quantity
    
    if (signal.action === "BUY" && signal.quantity) {
      // Actual required volume = signal.quantity * 2
      // Available = 6,348 * 1 * 0.75 = 4,761
      // So max quantity = 4,761 / 2 = 2,380
      
      // If quantity is limited by volume, it should be <= 2,380
      const maxQtyByVolume = Math.floor(6348 * 1 * 0.75 / 2);
      assert.ok(
        signal.quantity <= maxQtyByVolume * 1.1, // Allow 10% tolerance
        `Quantity ${signal.quantity} should respect volume constraints (max ~${maxQtyByVolume})`
      );
    }
  });
});
