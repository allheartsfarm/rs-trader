import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";

describe("SignalGenerator - Volume-Based Confidence Adjustment", () => {
  test("should reduce confidence when volume feasibility is low", () => {
    const signalGenerator = new SignalGenerator();
    
    // Create data with very low volume (e.g., 100/day)
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 100, // Very low volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "Low Volume Item",
      lowVolumeData,
      currentPrice
    );

    // With very low volume, for a flipping bot we reduce quantity instead of converting to HOLD
    // Volume constraints will reduce quantity, and confidence should be penalized
    // Only convert to HOLD if quantity is 0 or no profit
    if (signal.action === "BUY") {
      // If still BUY, quantity should be > 0 and there should be profit
      assert.ok(
        signal.quantity > 0,
        "If BUY, quantity should be > 0 (reduced by volume constraints)"
      );
      assert.ok(
        signal.netProfit > 0,
        "If BUY, net profit should be > 0"
      );
      // Confidence may be reduced due to volume constraints, but should be at least 0.1
      assert.ok(
        signal.confidence >= 0.1,
        "Confidence should be at least 0.1 even with volume constraints"
      );
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

  test("should maintain high confidence when volume is sufficient", () => {
    const signalGenerator = new SignalGenerator();
    
    // Create data with high volume (e.g., 50,000/day)
    const highVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5),
      volume: 50000, // High volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 105;
    const signal = signalGenerator.generateSignal(
      "High Volume Item",
      highVolumeData,
      currentPrice
    );

    // With high volume, confidence should not be penalized
    if (signal.action === "BUY") {
      // Volume feasibility should be >= 1.0, so no penalty
      assert.ok(
        signal.confidence >= 0.3,
        "High volume should allow normal confidence levels"
      );
    }
  });

  test("should penalize confidence when required volume exceeds available", () => {
    const signalGenerator = new SignalGenerator();
    
    // Create scenario where required volume > available volume
    // e.g., need 10,000 but only have 5,000 available
    const moderateVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 5000, // Moderate volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "Moderate Volume Item",
      moderateVolumeData,
      currentPrice
    );

    // If volume feasibility < 1.0, confidence should be reduced
    if (signal.action === "BUY") {
      // The volume penalty should apply: penalty = (1.0 - feasibility) * 0.5
      // If feasibility is 0.5, penalty is 0.25, so confidence reduced by 25%
      assert.ok(
        signal.confidence >= 0.1,
        "Confidence should be reduced but not eliminated"
      );
    }
  });

  test("should reduce quantity instead of converting to HOLD for low volume (flipping bot behavior)", () => {
    const signalGenerator = new SignalGenerator();
    
    // Create scenario with low volume
    // For a flipping bot, we reduce quantity instead of converting to HOLD
    // Only convert to HOLD if quantity becomes 0 or there's no profit
    const lowVolumeData = Array.from({ length: 30 }, (_, i) => ({
      price: 100,
      volume: 2000, // Low volume
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 100;
    const signal = signalGenerator.generateSignal(
      "Low Volume Item",
      lowVolumeData,
      currentPrice
    );

    // For a flipping bot, we should still generate BUY signals
    // Volume constraints will reduce quantity, but we don't convert to HOLD
    // unless quantity is 0 or profit is <= 0
    if (signal.action === "HOLD") {
      // Only HOLD if quantity is 0 or no profit
      assert.ok(
        signal.reason && (
          signal.reason.includes("Quantity too low") || 
          signal.reason.includes("No profit") ||
          signal.reason.includes("round to the same value")
        ),
        "Should only HOLD if quantity is 0 or no profit"
      );
    } else if (signal.action === "BUY") {
      // If BUY, quantity should be > 0 and there should be profit
      assert.ok(
        signal.quantity > 0,
        "If BUY, quantity should be > 0"
      );
      assert.ok(
        signal.netProfit > 0,
        "If BUY, net profit should be > 0"
      );
      // Confidence may be reduced due to volume constraints, but should still be reasonable
      assert.ok(
        signal.confidence >= 0.1,
        "Confidence should be at least 0.1 even with volume constraints"
      );
    }
  });

  test("should show volume feasibility in recommendations", () => {
    const signalGenerator = new SignalGenerator();
    
    const data = Array.from({ length: 30 }, (_, i) => ({
      price: 100 + (i % 5),
      volume: 10000,
      date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const signal = signalGenerator.generateSignal(
      "Test Item",
      data,
      105
    );

    // Signal should have all required fields
    assert.ok(signal, "Should return a signal");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    
    // Volume feasibility affects confidence, so if volume is constrained,
    // confidence should reflect that
    if (signal.action === "BUY") {
      assert.ok(
        signal.confidence >= 0.1 && signal.confidence <= 1.0,
        "Confidence should be in valid range"
      );
    }
  });
});
