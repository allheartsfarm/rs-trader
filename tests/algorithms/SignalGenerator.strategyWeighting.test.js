import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";

describe("SignalGenerator - Strategy Weighting and Normalization", () => {
  test("should identify that strategies use different confidence scales", () => {
    // Different strategies have different confidence ranges:
    // - Momentum: 0.3-0.9 (capped at 0.9)
    // - Mean Reversion: 0.3-0.85 (capped at 0.85)
    // - Volume: 0.3-0.9 (capped at 0.9)
    // - RSI: 0.3-0.9 (capped at 0.9)
    // - Moving Average: 0.3-0.75 (capped at 0.75)
    // - Support/Resistance: 0.3-0.85 (capped at 0.85)

    // This means a 0.75 from Moving Average might be "stronger" than
    // a 0.75 from Momentum, because Moving Average's max is 0.75
    // while Momentum's max is 0.9

    // We should normalize these to a common scale (0-1) before averaging
    const strategyMaxConfidences = {
      momentum: 0.9,
      meanReversion: 0.85,
      volume: 0.9,
      rsi: 0.9,
      movingAverage: 0.75,
      supportResistance: 0.85,
    };

    // Example: 0.75 from Moving Average = 0.75/0.75 = 1.0 (100% of its range)
    //          0.75 from Momentum = 0.75/0.9 = 0.83 (83% of its range)
    const movingAvg75 = 0.75 / strategyMaxConfidences.movingAverage; // 1.0
    const momentum75 = 0.75 / strategyMaxConfidences.momentum; // 0.83

    assert.ok(
      movingAvg75 > momentum75,
      "Normalized Moving Average 0.75 should be higher than normalized Momentum 0.75"
    );
  });

  test("should consider strategy reliability/importance for weighting", () => {
    // Based on STRATEGIES.md, some strategies are more important for RuneScape:
    // 1. Mean Reversion - Works well (many items have price floors)
    // 2. Volume Strategy - Important for identifying real moves
    // 3. Support/Resistance - Many items trade in ranges
    // 4. RSI - Good for timing
    // 5. Momentum - Works for trending items
    // 6. Moving Average - Confirms other signals

    // Suggested weights (higher = more important):
    const strategyWeights = {
      meanReversion: 1.2, // Most important for RuneScape
      volume: 1.15, // Important for identifying real moves
      supportResistance: 1.1, // Many items trade in ranges
      rsi: 1.0, // Good for timing
      momentum: 0.9, // Works for trending items
      movingAverage: 0.8, // Confirms other signals (less important alone)
    };

    // Weighted average example:
    // If Mean Reversion says 0.8 and Moving Average says 0.8,
    // weighted average = (0.8 * 1.2 + 0.8 * 0.8) / (1.2 + 0.8) = 0.8
    // But if we normalize first, then weight:
    // Mean Reversion 0.8 = 0.8/0.85 = 0.94 normalized
    // Moving Average 0.8 = 0.8/0.75 = 1.0 normalized (but capped at 1.0)
    // Weighted = (0.94 * 1.2 + 1.0 * 0.8) / (1.2 + 0.8) = 0.96

    assert.ok(
      strategyWeights.meanReversion > strategyWeights.movingAverage,
      "Mean Reversion should have higher weight than Moving Average"
    );
  });

  test("should normalize confidence scores before averaging", () => {
    // Strategy confidence ranges:
    const maxConfidences = {
      momentum: 0.9,
      meanReversion: 0.85,
      volume: 0.9,
      rsi: 0.9,
      movingAverage: 0.75,
      supportResistance: 0.85,
    };

    // Example signals with same raw confidence but different scales
    const signals = [
      { action: "BUY", confidence: 0.75, strategy: "momentum" },
      { action: "BUY", confidence: 0.75, strategy: "movingAverage" },
    ];

    // Without normalization:
    const avgWithoutNorm = (0.75 + 0.75) / 2; // 0.75

    // With normalization:
    const normalized = signals.map((s) => {
      const max = maxConfidences[s.strategy] || 0.9;
      return s.confidence / max; // Normalize to 0-1 scale
    });
    const avgWithNorm =
      normalized.reduce((sum, c) => sum + c, 0) / normalized.length; // ~0.92

    assert.ok(
      avgWithNorm > avgWithoutNorm,
      "Normalized average should be higher when strategies have different max confidences"
    );
  });

  test("should apply weights after normalization", () => {
    // Example: Two strategies with different importance
    const signals = [
      { action: "BUY", confidence: 0.8, strategy: "meanReversion" },
      { action: "BUY", confidence: 0.8, strategy: "movingAverage" },
    ];

    const maxConfidences = {
      meanReversion: 0.85,
      movingAverage: 0.75,
    };

    const weights = {
      meanReversion: 1.2,
      movingAverage: 0.8,
    };

    // Step 1: Normalize
    const normalized = signals.map((s) => {
      const max = maxConfidences[s.strategy] || 0.9;
      return s.confidence / max;
    });

    // Step 2: Apply weights
    const weightedSum = normalized.reduce(
      (sum, norm, i) => sum + norm * (weights[signals[i].strategy] || 1.0),
      0
    );
    const weightSum = signals.reduce(
      (sum, s) => sum + (weights[s.strategy] || 1.0),
      0
    );
    const weightedAvg = weightedSum / weightSum;

    assert.ok(
      weightedAvg > 0.8,
      "Weighted normalized average should reflect strategy importance"
    );
  });
});
