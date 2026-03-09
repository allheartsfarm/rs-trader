import { test, describe, mock } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";
import { TradeMemory } from "../../src/bot/TradeMemory.js";

// Mock readline to prevent tests from hanging
const mockRl = {
  question: (query, callback) => {
    process.nextTick(() => callback('Q'));
  },
  close: () => {},
  pause: () => {},
  resume: () => {}
};

describe("TradeManager", () => {
  test("should create TradeManager instance", () => {
    const manager = new TradeManager(mockRl);
    assert.ok(manager, "Should create TradeManager instance");
    assert.ok(manager.memory instanceof TradeMemory, "Should have TradeMemory instance");
  });

  test("should format trade for display", () => {
    const manager = new TradeManager(mockRl);
    const trade = {
      item: "Iron ore",
      action: "buy",
      quantity: 1000,
      price: 440,
      index: 0
    };
    
    const formatted = manager.formatTrade(trade, 0);
    
    assert.ok(formatted.includes("Iron ore"), "Should include item name");
    assert.ok(formatted.includes("1000"), "Should include quantity");
    // formatGP might format as "440" or "440k", so check for either
    assert.ok(formatted.includes("440") || formatted.includes("0.44k"), "Should include price");
  });

  test("should validate trade index", () => {
    const manager = new TradeManager(mockRl);
    manager.memory.addTrade({ item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 });
    
    assert.ok(manager.isValidIndex(0), "Should validate index 0");
    assert.ok(!manager.isValidIndex(5), "Should invalidate index 5");
    assert.ok(!manager.isValidIndex(-1), "Should invalidate negative index");
  });
});
