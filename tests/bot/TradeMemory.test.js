import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeMemory } from "../../src/bot/TradeMemory.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("TradeMemory", () => {
  test("should create a new TradeMemory instance", () => {
    const memory = new TradeMemory();
    assert.ok(memory, "Should create TradeMemory instance");
    assert.ok(memory.trades instanceof Array, "Should have trades array");
    assert.ok(memory.trades.length === 0, "Should start with empty trades");
  });

  test("should add a trade to memory", () => {
    const memory = new TradeMemory();
    const trade = {
      item: "Iron ore",
      action: "buy",
      quantity: 1000,
      price: 440,
      index: 0
    };
    
    memory.addTrade(trade);
    
    assert.ok(memory.trades.length === 1, "Should have 1 trade");
    assert.ok(memory.trades[0].item === "Iron ore", "Should store trade item");
    assert.ok(memory.trades[0].quantity === 1000, "Should store trade quantity");
  });

  test("should not allow more than 3 trades (max GE slots)", () => {
    const memory = new TradeMemory();
    
    // Add 3 trades successfully
    for (let i = 0; i < 3; i++) {
      memory.addTrade({
        item: `Item ${i}`,
        action: "buy",
        quantity: 100,
        price: 100,
        index: i
      });
    }
    
    assert.ok(memory.trades.length === 3, `Should have 3 trades, got ${memory.trades.length}`);
    
    // Try to add a 4th trade - should throw error
    assert.throws(() => {
      memory.addTrade({
        item: "Item 4",
        action: "buy",
        quantity: 100,
        price: 100,
        index: 3
      });
    }, /Cannot add more than 3 trades/);
    
    assert.ok(memory.trades.length === 3, `Should still have 3 trades after failed add, got ${memory.trades.length}`);
  });

  test("should update trade price", () => {
    const memory = new TradeMemory();
    memory.addTrade({
      item: "Iron ore",
      action: "buy",
      quantity: 1000,
      price: 440,
      index: 0
    });
    
    memory.updateTrade(0, { price: 450 });
    
    assert.ok(memory.trades[0].price === 450, "Should update price to 450");
    assert.ok(memory.trades[0].quantity === 1000, "Should not change quantity");
  });

  test("should update trade quantity", () => {
    const memory = new TradeMemory();
    memory.addTrade({
      item: "Iron ore",
      action: "buy",
      quantity: 1000,
      price: 440,
      index: 0
    });
    
    memory.updateTrade(0, { quantity: 2000 });
    
    assert.ok(memory.trades[0].quantity === 2000, "Should update quantity to 2000");
    assert.ok(memory.trades[0].price === 440, "Should not change price");
  });

  test("should delete a trade by index", () => {
    const memory = new TradeMemory();
    memory.addTrade({ item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 });
    memory.addTrade({ item: "Coal", action: "buy", quantity: 500, price: 180, index: 1 });
    
    memory.deleteTrade(0);
    
    assert.ok(memory.trades.length === 1, "Should have 1 trade after deletion");
    assert.ok(memory.trades[0].item === "Coal", "Should keep remaining trade");
  });

  test("should persist trades to file", async () => {
    const memoryFile = path.join(__dirname, "../../.cache", "trade-memory.json");
    
    // Clean up
    try {
      await fs.unlink(memoryFile);
    } catch (e) {
      // Ignore
    }
    
    const memory = new TradeMemory();
    memory.addTrade({ item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 });
    
    await memory.save();
    
    // Verify file exists
    const exists = await fs.access(memoryFile).then(() => true).catch(() => false);
    assert.ok(exists, "Should create memory file");
    
    // Verify content
    const data = JSON.parse(await fs.readFile(memoryFile, "utf-8"));
    assert.ok(data.trades.length === 1, "Should save trades to file");
    assert.ok(data.trades[0].item === "Iron ore", "Should save correct trade data");
    
    // Clean up
    try {
      await fs.unlink(memoryFile);
    } catch (e) {
      // Ignore
    }
  });

  test("should load trades from file", async () => {
    const memoryFile = path.join(__dirname, "../../.cache", "trade-memory.json");
    
    // Create test file
    const testData = {
      trades: [
        { item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 },
        { item: "Coal", action: "sell", quantity: 500, price: 180, index: 1 }
      ]
    };
    
    const cacheDir = path.dirname(memoryFile);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(memoryFile, JSON.stringify(testData, null, 2));
    
    const memory = new TradeMemory();
    await memory.load();
    
    assert.ok(memory.trades.length === 2, "Should load 2 trades");
    assert.ok(memory.trades[0].item === "Iron ore", "Should load first trade");
    assert.ok(memory.trades[1].item === "Coal", "Should load second trade");
    
    // Clean up
    try {
      await fs.unlink(memoryFile);
    } catch (e) {
      // Ignore
    }
  });

  test("should get trade by index", () => {
    const memory = new TradeMemory();
    memory.addTrade({ item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 });
    memory.addTrade({ item: "Coal", action: "buy", quantity: 500, price: 180, index: 1 });
    
    const trade = memory.getTrade(1);
    
    assert.ok(trade, "Should get trade");
    assert.ok(trade.item === "Coal", "Should get correct trade");
  });

  test("should return null for invalid index", () => {
    const memory = new TradeMemory();
    memory.addTrade({ item: "Iron ore", action: "buy", quantity: 1000, price: 440, index: 0 });
    
    const trade = memory.getTrade(5);
    
    assert.ok(trade === null, "Should return null for invalid index");
  });
});
