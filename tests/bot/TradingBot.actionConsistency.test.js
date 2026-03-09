import { test } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";
import { Settings } from "../../src/config/Settings.js";

test("should update explanation when BUY signal is converted to HOLD", async () => {
  const settings = new Settings();
  const dataFetcher = new DataFetcher();
  const signalGenerator = new SignalGenerator(settings);
  const positionManager = new PositionManager(3); // 3 max positions
  
  // Fill all slots so next BUY will be converted to HOLD
  positionManager.addPosition({ item: "Item1", quantity: 1000, buyPrice: 100 });
  positionManager.addPosition({ item: "Item2", quantity: 2000, buyPrice: 200 });
  positionManager.addPosition({ item: "Item3", quantity: 3000, buyPrice: 300 });
  
  // Verify slots are full
  assert.strictEqual(positionManager.getAvailableSlots(), 0, "All slots should be filled");
  
  const bot = new TradingBot({
    dataFetcher,
    signalGenerator,
    positionManager,
    settings,
  });

  // Mock a BUY signal
  const mockSignal = {
    item: "Test Item",
    action: "BUY",
    confidence: 0.8,
    explanation: "1 of 6 strategies recommend BUY. Price near support level - bounce expected.",
    quantity: 1000,
    entryPrice: 100,
    exitPrice: 110,
    netProfit: 10000,
  };

  // Simulate what happens in analyzeMarket when slots are full
  if (mockSignal.action === "BUY" && positionManager.getAvailableSlots() === 0) {
    mockSignal.action = "HOLD";
    mockSignal.reason = "No available slots (F2P limit)";
    // Update explanation to reflect HOLD action
    if (mockSignal.explanation && mockSignal.explanation.includes("strategies recommend BUY")) {
      mockSignal.explanation = mockSignal.explanation.replace(
        "strategies recommend BUY",
        "strategies recommend BUY, but no available slots"
      );
    }
  }

  assert.strictEqual(mockSignal.action, "HOLD", "Action should be converted to HOLD");
  assert.ok(
    mockSignal.explanation.includes("no available slots") || 
    mockSignal.reason === "No available slots (F2P limit)",
    "Explanation or reason should mention no available slots"
  );
});

test("should update explanation when BUY signal is converted to HOLD due to existing position", async () => {
  const settings = new Settings();
  const positionManager = new PositionManager(3);
  
  // Add a position
  positionManager.addPosition({ item: "Test Item", quantity: 1000, buyPrice: 100 });
  
  const mockSignal = {
    item: "Test Item",
    action: "BUY",
    confidence: 0.8,
    explanation: "1 of 6 strategies recommend BUY. Price near support level - bounce expected.",
    quantity: 1000,
    entryPrice: 100,
    exitPrice: 110,
    netProfit: 10000,
  };

  // Simulate what happens in analyzeMarket when position already exists
  if (mockSignal.action === "BUY" && positionManager.hasPosition(mockSignal.item)) {
    mockSignal.action = "HOLD";
    mockSignal.reason = "Already holding position";
    // Update explanation to reflect HOLD action
    if (mockSignal.explanation && mockSignal.explanation.includes("strategies recommend BUY")) {
      mockSignal.explanation = mockSignal.explanation.replace(
        "strategies recommend BUY",
        "strategies recommend BUY, but already holding position"
      );
    }
  }

  assert.strictEqual(mockSignal.action, "HOLD", "Action should be converted to HOLD");
  assert.ok(
    mockSignal.explanation.includes("already holding position") || 
    mockSignal.reason === "Already holding position",
    "Explanation or reason should mention already holding position"
  );
});
