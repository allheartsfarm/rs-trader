import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../../src/algorithms/SignalGenerator.js";
import { MomentumStrategy } from "../../../src/algorithms/strategies/MomentumStrategy.js";
import { MeanReversionStrategy } from "../../../src/algorithms/strategies/MeanReversionStrategy.js";
import { VolumeStrategy } from "../../../src/algorithms/strategies/VolumeStrategy.js";
import { RSIStrategy } from "../../../src/algorithms/strategies/RSIStrategy.js";
import { MovingAverageStrategy } from "../../../src/algorithms/strategies/MovingAverageStrategy.js";
import { SupportResistanceStrategy } from "../../../src/algorithms/strategies/SupportResistanceStrategy.js";

describe("All Strategies - Signal Generation", () => {
  // Create realistic historical data (30 days)
  function createRealisticData(basePrice = 100, trend = "up") {
    const data = [];
    let price = basePrice;
    for (let i = 0; i < 30; i++) {
      const date = new Date(`2024-01-${String(i + 1).padStart(2, "0")}`);
      // Add realistic price movement
      const change = trend === "up" 
        ? (Math.random() * 0.05 - 0.01) // Slight upward bias
        : (Math.random() * 0.05 - 0.03); // Slight downward bias
      price = Math.max(1, price * (1 + change));
      
      // Add realistic volume
      const volume = Math.floor(5000 + Math.random() * 10000);
      
      data.push({
        price: Math.round(price * 100) / 100,
        volume: volume,
        date: date,
        timestamp: date.getTime(),
      });
    }
    return data;
  }

  test("should initialize all 6 strategies in SignalGenerator", () => {
    const generator = new SignalGenerator();
    assert.strictEqual(generator.strategies.length, 6, "Should have 6 strategies");
    
    const strategyNames = generator.strategies.map(s => s.name);
    assert.ok(strategyNames.includes("Momentum"), "Should include Momentum");
    assert.ok(strategyNames.includes("MeanReversion"), "Should include MeanReversion");
    assert.ok(strategyNames.includes("Volume"), "Should include Volume");
    assert.ok(strategyNames.includes("RSI"), "Should include RSI");
    assert.ok(strategyNames.includes("MovingAverage"), "Should include MovingAverage");
    assert.ok(strategyNames.includes("SupportResistance"), "Should include SupportResistance");
  });

  test("MomentumStrategy should generate signals", () => {
    const strategy = new MomentumStrategy();
    const data = createRealisticData(100, "up");
    const currentPrice = 110;
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "Momentum", "Should have correct strategy name");
  });

  test("MeanReversionStrategy should generate signals", () => {
    const strategy = new MeanReversionStrategy();
    const data = createRealisticData(100, "up");
    const currentPrice = 90; // Below average for mean reversion
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "MeanReversion", "Should have correct strategy name");
  });

  test("VolumeStrategy should generate signals", () => {
    const strategy = new VolumeStrategy();
    const data = createRealisticData(100, "up");
    // Make last volume high
    data[data.length - 1].volume = 50000;
    const currentPrice = 105;
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "Volume", "Should have correct strategy name");
  });

  test("RSIStrategy should generate signals", () => {
    const strategy = new RSIStrategy();
    // Create data with downward trend (oversold)
    const data = [];
    let price = 100;
    for (let i = 0; i < 20; i++) {
      price = price * 0.98; // Downward trend
      data.push({
        price: price,
        date: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      });
    }
    const currentPrice = price;
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "RSI", "Should have correct strategy name");
  });

  test("MovingAverageStrategy should generate signals", () => {
    const strategy = new MovingAverageStrategy();
    const data = createRealisticData(100, "up");
    const currentPrice = 110;
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "MovingAverage", "Should have correct strategy name");
  });

  test("SupportResistanceStrategy should generate signals", () => {
    const strategy = new SupportResistanceStrategy();
    const data = createRealisticData(100, "up");
    const currentPrice = 95; // Near support
    
    const signal = strategy.analyze(data, currentPrice, { maxTradeDurationDays: 5 });
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1, "Confidence should be 0-1");
    assert.strictEqual(signal.strategy, "SupportResistance", "Should have correct strategy name");
  });

  test("SignalGenerator should call all strategies and aggregate results", () => {
    const generator = new SignalGenerator();
    const data = createRealisticData(100, "up");
    const currentPrice = 105;
    
    const signal = generator.generateSignal("Test Item", data, currentPrice);
    
    assert.ok(signal, "Should return a signal");
    assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), "Should have valid action");
    assert.ok(typeof signal.confidence === "number", "Should have confidence");
    assert.ok(Array.isArray(signal.strategies), "Should have strategies array");
    assert.strictEqual(signal.strategies.length, 6, "Should have all 6 strategies");
    assert.ok(Array.isArray(signal.strategySignals), "Should have strategySignals array");
    assert.strictEqual(signal.strategySignals.length, 6, "Should have signals from all 6 strategies");
    
    // Verify all strategies returned signals
    signal.strategySignals.forEach(strategySignal => {
      assert.ok(strategySignal, "Each strategy should return a signal");
      assert.ok(["BUY", "SELL", "HOLD"].includes(strategySignal.action), "Each signal should have valid action");
      assert.ok(typeof strategySignal.confidence === "number", "Each signal should have confidence");
      assert.ok(strategySignal.strategy, "Each signal should have strategy name");
    });
  });

  test("all strategies should handle insufficient data gracefully", () => {
    const strategies = [
      new MomentumStrategy(),
      new MeanReversionStrategy(),
      new VolumeStrategy(),
      new RSIStrategy(),
      new MovingAverageStrategy(),
      new SupportResistanceStrategy(),
    ];
    
    const insufficientData = [
      { price: 100, date: new Date("2024-01-01") },
      { price: 101, date: new Date("2024-01-02") },
    ];
    
    strategies.forEach(strategy => {
      const signal = strategy.analyze(insufficientData, 102);
      assert.ok(signal, `${strategy.name} should return a signal even with insufficient data`);
      assert.ok(["BUY", "SELL", "HOLD"].includes(signal.action), `${strategy.name} should have valid action`);
      assert.strictEqual(signal.strategy, strategy.name, `${strategy.name} should have correct name`);
    });
  });

  test("all strategies should handle volume feasibility option", () => {
    const strategies = [
      new MomentumStrategy(),
      new MeanReversionStrategy(),
      new VolumeStrategy(),
      new RSIStrategy(),
      new MovingAverageStrategy(),
      new SupportResistanceStrategy(),
    ];
    
    const data = createRealisticData(100, "up");
    const options = {
      maxTradeDurationDays: 5,
      volumeFeasibility: 0.5, // 50% feasible
      avgDailyVolume: 10000,
    };
    
    strategies.forEach(strategy => {
      const signal = strategy.analyze(data, 105, options);
      assert.ok(signal, `${strategy.name} should handle volume feasibility option`);
      // Strategies that use volumeFeasibility should adjust confidence
      // (Momentum and MeanReversion do this)
      assert.ok(typeof signal.confidence === "number", `${strategy.name} should have confidence`);
    });
  });
});
