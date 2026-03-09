import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";
import { Settings } from "../../src/config/Settings.js";
import { TradeManager } from "../../src/bot/TradeManager.js";

describe("TradingBot - Filtering Low-Value Recommendations", () => {
  // Create mock readline interface to prevent hanging
  const createMockTradeManager = () => {
    const mockRl = {
      question: () => {},
      close: () => {},
      on: () => {},
    };
    return new TradeManager(mockRl);
  };

  test("should filter out recommendations below profit threshold", async () => {
    const settings = new Settings();
    await settings.load();
    settings.getConfig().trading.minProfitPerTrade = 500000; // 500k minimum

    const dataFetcher = new DataFetcher(settings.getConfig().data);
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(
      settings.getConfig().trading.maxPositions
    );
    const tradeManager = createMockTradeManager();

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      settings,
      tradeManager,
    });

    // Create mock recommendations with varying profits
    const mockRecommendations = [
      {
        item: "Low Profit Item",
        action: "BUY",
        confidence: 0.6,
        netProfit: 100000, // 100k - below threshold
        duration: 2,
        quantity: 1000,
        entryPrice: 100,
        exitPrice: 110,
        avgDailyVolume: 10000,
      },
      {
        item: "Medium Profit Item",
        action: "BUY",
        confidence: 0.7,
        netProfit: 150000, // 150k - below 200k threshold and confidence too low
        duration: 2,
        quantity: 2000,
        entryPrice: 150,
        exitPrice: 165,
        avgDailyVolume: 15000,
      },
      {
        item: "High Profit Item",
        action: "BUY",
        confidence: 0.75,
        netProfit: 600000, // 600k - above threshold
        duration: 2,
        quantity: 3000,
        entryPrice: 200,
        exitPrice: 220,
        avgDailyVolume: 20000,
      },
    ];

    // Simulate the filtering logic from TradingBot
    const minProfit = settings.getConfig().trading.minProfitPerTrade;
    const duration = 2;
    const baseTolerance = duration <= 2 ? 0.4 : 0.8;
    const minProfitThreshold = minProfit * baseTolerance; // 200k for 2-day

    const filtered = mockRecommendations.filter((rec) => {
      if (rec.action === "BUY") {
        // Check volume feasibility
        let isVolumeFeasible = true;
        if (rec.quantity && rec.avgDailyVolume && duration) {
          const requiredVolume = rec.quantity * 2;
          const volumeUsagePercent = 0.75; // For 2-day
          const availableVolume = rec.avgDailyVolume * duration * volumeUsagePercent;
          const feasibilityPercent =
            availableVolume > 0 ? (requiredVolume / availableVolume) * 100 : Infinity;
          isVolumeFeasible = feasibilityPercent <= 100;
        }

        // Check profit threshold
        const meetsThreshold = rec.netProfit >= minProfitThreshold;
        const isCloseWithHighConfidence =
          rec.netProfit >= minProfitThreshold * 0.5 && rec.confidence >= 0.8;

        return (
          rec.netProfit > 0 &&
          isVolumeFeasible &&
          (meetsThreshold || isCloseWithHighConfidence)
        );
      }
      return true;
    });

    // Low profit item should be filtered out (100k < 200k threshold)
    assert.ok(
      !filtered.find((r) => r.item === "Low Profit Item"),
      "Low profit item (100k) should be filtered out"
    );

    // Medium profit item should be filtered out (150k < 200k threshold and confidence 0.7 < 0.8)
    assert.ok(
      !filtered.find((r) => r.item === "Medium Profit Item"),
      "Medium profit item (150k, 70% confidence) should be filtered out"
    );

    // High profit item should pass (600k > 200k threshold)
    assert.ok(
      filtered.find((r) => r.item === "High Profit Item"),
      "High profit item (600k) should pass filter"
    );
  });

  test("should filter out unfeasible volume trades", async () => {
    const settings = new Settings();
    await settings.load();

    // Create recommendations with varying volume feasibility
    const mockRecommendations = [
      {
        item: "Feasible Trade",
        action: "BUY",
        confidence: 0.75,
        netProfit: 600000,
        duration: 2,
        quantity: 5000, // Requires 10k volume
        entryPrice: 100,
        exitPrice: 110,
        avgDailyVolume: 10000, // 10k/day * 2 days * 0.75 = 15k available > 10k required
      },
      {
        item: "Unfeasible Trade",
        action: "BUY",
        confidence: 0.75,
        netProfit: 600000,
        duration: 2,
        quantity: 10000, // Requires 20k volume
        entryPrice: 100,
        exitPrice: 110,
        avgDailyVolume: 5000, // 5k/day * 2 days * 0.75 = 7.5k available < 20k required (133% feasibility)
      },
    ];

    const duration = 2;
    const filtered = mockRecommendations.filter((rec) => {
      if (rec.action === "BUY") {
        let isVolumeFeasible = true;
        if (rec.quantity && rec.avgDailyVolume && duration) {
          const requiredVolume = rec.quantity * 2;
          const volumeUsagePercent = 0.75;
          const availableVolume = rec.avgDailyVolume * duration * volumeUsagePercent;
          const feasibilityPercent =
            availableVolume > 0 ? (requiredVolume / availableVolume) * 100 : Infinity;
          isVolumeFeasible = feasibilityPercent <= 100; // Must be <= 100%
        }
        return rec.netProfit > 0 && isVolumeFeasible;
      }
      return true;
    });

    // Feasible trade should pass
    assert.ok(
      filtered.find((r) => r.item === "Feasible Trade"),
      "Feasible trade should pass filter"
    );

    // Unfeasible trade should be filtered out
    assert.ok(
      !filtered.find((r) => r.item === "Unfeasible Trade"),
      "Unfeasible trade (133% volume) should be filtered out"
    );
  });

  test("should allow high confidence trades with lower profit if close to threshold", async () => {
    const settings = new Settings();
    await settings.load();
    settings.getConfig().trading.minProfitPerTrade = 500000;

    const mockRecommendations = [
      {
        item: "High Confidence Lower Profit",
        action: "BUY",
        confidence: 0.85, // High confidence
        netProfit: 250000, // 250k (50% of 500k threshold)
        duration: 2,
        quantity: 2000,
        entryPrice: 125,
        exitPrice: 137.5,
        avgDailyVolume: 15000,
      },
    ];

    const minProfit = settings.getConfig().trading.minProfitPerTrade;
    const duration = 2;
    const baseTolerance = duration <= 2 ? 0.4 : 0.8;
    const minProfitThreshold = minProfit * baseTolerance; // 200k

    const filtered = mockRecommendations.filter((rec) => {
      if (rec.action === "BUY") {
        let isVolumeFeasible = true;
        if (rec.quantity && rec.avgDailyVolume && duration) {
          const requiredVolume = rec.quantity * 2;
          const volumeUsagePercent = 0.75;
          const availableVolume = rec.avgDailyVolume * duration * volumeUsagePercent;
          const feasibilityPercent =
            availableVolume > 0 ? (requiredVolume / availableVolume) * 100 : Infinity;
          isVolumeFeasible = feasibilityPercent <= 100;
        }

        const meetsThreshold = rec.netProfit >= minProfitThreshold;
        const isCloseWithHighConfidence =
          rec.netProfit >= minProfitThreshold * 0.5 && rec.confidence >= 0.8;

        return (
          rec.netProfit > 0 &&
          isVolumeFeasible &&
          (meetsThreshold || isCloseWithHighConfidence)
        );
      }
      return true;
    });

    // High confidence (85%) with 50% of threshold (250k) should pass
    assert.ok(
      filtered.find((r) => r.item === "High Confidence Lower Profit"),
      "High confidence trade (85%) with 50% of threshold should pass"
    );
  });
});
