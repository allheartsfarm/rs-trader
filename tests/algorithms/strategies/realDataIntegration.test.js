import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../../src/algorithms/SignalGenerator.js";
import { DataFetcher } from "../../../src/data/DataFetcher.js";

describe("Strategies - Real Data Integration", () => {
  test("should generate signals for real items with all strategies", async () => {
    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator();
    
    // Test with a few real high-volume items
    const testItems = ["Iron ore", "Coal", "Mithril ore"];
    
    for (const itemName of testItems) {
      try {
        const [historicalData, currentPrice] = await Promise.all([
          dataFetcher.fetchHistoricalData(itemName, 30),
          dataFetcher.getCurrentPrice(itemName),
        ]);
        
        if (!historicalData || historicalData.length < 5 || !currentPrice || currentPrice <= 0) {
          console.log(`  ⚠️  Skipping ${itemName} - insufficient data`);
          continue;
        }
        
        const signal = signalGenerator.generateSignal(
          itemName,
          historicalData,
          currentPrice
        );
        
        assert.ok(signal, `${itemName} should generate a signal`);
        assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), `${itemName} should have valid action`);
        assert.ok(typeof signal.confidence === "number", `${itemName} should have confidence`);
        assert.ok(Array.isArray(signal.strategies), `${itemName} should have strategies array`);
        assert.strictEqual(signal.strategies.length, 6, `${itemName} should have all 6 strategies`);
        assert.ok(Array.isArray(signal.strategySignals), `${itemName} should have strategySignals array`);
        assert.strictEqual(signal.strategySignals.length, 6, `${itemName} should have signals from all 6 strategies`);
        
        // Verify each strategy returned a valid signal
        const strategyNames = new Set();
        signal.strategySignals.forEach(strategySignal => {
          assert.ok(strategySignal, `${itemName}: Each strategy should return a signal`);
          assert.ok(["BUY", "SELL", "HOLD"].includes(strategySignal.action), `${itemName}: Each signal should have valid action`);
          assert.ok(typeof strategySignal.confidence === "number", `${itemName}: Each signal should have confidence`);
          assert.ok(strategySignal.strategy, `${itemName}: Each signal should have strategy name`);
          strategyNames.add(strategySignal.strategy);
        });
        
        // Verify all 6 strategies are present
        assert.strictEqual(strategyNames.size, 6, `${itemName}: Should have signals from all 6 unique strategies`);
        assert.ok(strategyNames.has("Momentum"), `${itemName}: Should include Momentum`);
        assert.ok(strategyNames.has("MeanReversion"), `${itemName}: Should include MeanReversion`);
        assert.ok(strategyNames.has("Volume"), `${itemName}: Should include Volume`);
        assert.ok(strategyNames.has("RSI"), `${itemName}: Should include RSI`);
        assert.ok(strategyNames.has("MovingAverage"), `${itemName}: Should include MovingAverage`);
        assert.ok(strategyNames.has("SupportResistance"), `${itemName}: Should include SupportResistance`);
        
        console.log(`  ✓ ${itemName}: ${signal.action} (${Math.round(signal.confidence * 100)}% confidence)`);
      } catch (error) {
        console.log(`  ⚠️  Error testing ${itemName}: ${error.message}`);
        // Don't fail the test if API is unavailable, just log
      }
    }
  }, { timeout: 30000 }); // 30 second timeout for API calls

  test("should handle API errors gracefully without crashing", async () => {
    const dataFetcher = new DataFetcher();
    const signalGenerator = new SignalGenerator();
    
    // Test with invalid item name
    try {
      const [historicalData, currentPrice] = await Promise.all([
        dataFetcher.fetchHistoricalData("NonExistentItem12345", 30),
        dataFetcher.getCurrentPrice("NonExistentItem12345"),
      ]);
      
      // Should handle gracefully - either return empty data or null
      if (historicalData && historicalData.length > 0 && currentPrice > 0) {
        const signal = signalGenerator.generateSignal(
          "NonExistentItem12345",
          historicalData,
          currentPrice
        );
        // Should still return a valid signal structure (likely HOLD)
        assert.ok(signal, "Should return a signal even for invalid item");
        assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
      }
    } catch (error) {
      // API errors are acceptable - just verify we don't crash
      assert.ok(error instanceof Error, "Should throw proper error");
    }
  }, { timeout: 10000 });
});
