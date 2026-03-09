import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
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

describe("TradingBot - Interactive Trade Management", () => {
  test("should initialize TradeManager in constructor", () => {
    const bot = new TradingBot({});
    bot.tradeManager.rl = mockRl;
    
    assert.ok(bot.tradeManager, "Should have tradeManager");
    assert.ok(bot.tradeManager instanceof TradeManager, "Should be TradeManager instance");
  });

  test("should allow custom TradeManager in constructor", () => {
    const customTradeManager = new TradeManager(mockRl);
    const bot = new TradingBot({ tradeManager: customTradeManager });
    
    assert.ok(bot.tradeManager === customTradeManager, "Should use custom TradeManager");
  });
});
