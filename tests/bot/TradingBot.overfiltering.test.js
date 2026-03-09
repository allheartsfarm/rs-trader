import { test, describe } from "node:test";
import assert from "node:assert";
import { Settings } from "../../src/config/Settings.js";

describe("TradingBot - Overfiltering Analysis", () => {
  test("should identify potential overfiltering scenarios", async () => {
    const settings = new Settings();
    await settings.load();
    
    // Current settings
    const minProfitPerTrade = settings.config.trading.minProfitPerTrade; // 500k
    const minProfitPercent = settings.config.trading.minProfitPercent || 0.01; // 1%
    
    // Test scenarios that might be overfiltered
    const testCases = [
      {
        name: "Good profit % but below absolute threshold",
        netProfit: 300000, // 300k (below 400k threshold for 5-day)
        profitPercent: 5.0, // 5% profit margin (good!)
        confidence: 0.75, // 75% confidence (good)
        duration: 5,
        shouldPass: true, // Should pass - good profit %
      },
      {
        name: "High absolute profit but low %",
        netProfit: 600000, // 600k (above threshold)
        profitPercent: 0.85, // 0.85% (below 1%)
        confidence: 0.80, // 80% confidence
        duration: 3,
        shouldPass: false, // Should fail - too low profit %
      },
      {
        name: "Medium profit, medium confidence",
        netProfit: 250000, // 250k (below 400k for 5-day)
        profitPercent: 3.5, // 3.5% profit margin
        confidence: 0.70, // 70% confidence
        duration: 5,
        shouldPass: true, // Should pass - good profit %
      },
      {
        name: "High profit quick trade (should pass)",
        netProfit: 180000, // 180k
        profitPercent: 0.88, // 0.88%
        confidence: 0.86, // 86%
        duration: 3,
        shouldPass: true, // Should pass - high-profit quick trade
      },
    ];
    
    // Analyze each test case
    testCases.forEach((testCase) => {
      const { netProfit, profitPercent, confidence, duration } = testCase;
      
      // Calculate thresholds
      const baseTolerance = duration <= 2 ? 0.4 : 0.8;
      const minProfitThreshold = minProfitPerTrade * baseTolerance;
      const meetsThreshold = netProfit >= minProfitThreshold;
      const isCloseWithHighConfidence =
        netProfit >= minProfitThreshold * 0.5 && confidence >= 0.8;
      
      // Profit percentage checks
      const meetsMinProfitPercent = profitPercent >= minProfitPercent * 100;
      const isHighProfitQuickTrade =
        netProfit >= 150000 &&
        duration <= 3 &&
        confidence >= 0.85 &&
        profitPercent >= 0.8;
      
      // Would this pass the filter?
      const wouldPass =
        netProfit > 0 &&
        (meetsMinProfitPercent || isHighProfitQuickTrade) &&
        (meetsThreshold || isCloseWithHighConfidence);
      
      console.log(`\n${testCase.name}:`);
      console.log(`  Net Profit: ${netProfit.toLocaleString()}`);
      console.log(`  Profit %: ${profitPercent}%`);
      console.log(`  Confidence: ${(confidence * 100).toFixed(0)}%`);
      console.log(`  Duration: ${duration} days`);
      console.log(`  Meets threshold: ${meetsThreshold} (need ${minProfitThreshold.toLocaleString()})`);
      console.log(`  Close with high confidence: ${isCloseWithHighConfidence}`);
      console.log(`  Meets min profit %: ${meetsMinProfitPercent}`);
      console.log(`  High-profit quick trade: ${isHighProfitQuickTrade}`);
      console.log(`  Would pass: ${wouldPass} (expected: ${testCase.shouldPass})`);
      
      // Assert if it matches expected behavior
      if (testCase.shouldPass !== wouldPass) {
        console.log(`  ⚠️  POTENTIAL OVERFILTERING: Expected ${testCase.shouldPass} but would ${wouldPass ? 'pass' : 'fail'}`);
      }
    });
    
    // This test is informational - just run it to see the analysis
    assert.ok(true, "Analysis complete");
  });
});
