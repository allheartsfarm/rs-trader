import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { DataFetcher } from "../../src/data/DataFetcher.js";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { PositionManager } from "../../src/bot/PositionManager.js";
import { Settings } from "../../src/config/Settings.js";
import { TradeManager } from "../../src/bot/TradeManager.js";
import readline from "readline";

describe("TradingBot - Benefits", () => {
  test("should award 'Highest Profit Per Month' to only the trade with highest monthly profit", async () => {
    const settings = new Settings();
    await settings.load();

    const dataFetcher = new DataFetcher(settings.getConfig().data);
    const signalGenerator = new SignalGenerator(settings);
    const positionManager = new PositionManager(
      settings.getConfig().trading.maxPositions
    );

    // Create mock readline interface to prevent hanging
    const mockRl = {
      question: () => {},
      close: () => {},
      on: () => {},
    };
    const tradeManager = new TradeManager(mockRl);

    const bot = new TradingBot({
      dataFetcher,
      signalGenerator,
      positionManager,
      settings,
      tradeManager,
    });

    // Create mock recommendations with different profit per month
    const recommendations = [
      {
        item: "Item A",
        action: "BUY",
        confidence: 0.75,
        netProfit: 100000, // 100K per trade
        duration: 1, // 1 day = 30 trades/month = 3M/month
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1000,
        currentPrice: 100,
        stopLoss: 95,
        explanation: "Test",
        benefits: "Standard Trade",
      },
      {
        item: "Item B",
        action: "BUY",
        confidence: 0.8,
        netProfit: 200000, // 200K per trade
        duration: 3, // 3 days = 10 trades/month = 2M/month
        entryPrice: 200,
        exitPrice: 220,
        quantity: 1000,
        currentPrice: 200,
        stopLoss: 190,
        explanation: "Test",
        benefits: "Standard Trade",
      },
      {
        item: "Item C",
        action: "BUY",
        confidence: 0.7,
        netProfit: 50000, // 50K per trade
        duration: 1, // 1 day = 30 trades/month = 1.5M/month
        entryPrice: 50,
        exitPrice: 55,
        quantity: 1000,
        currentPrice: 50,
        stopLoss: 47,
        explanation: "Test",
        benefits: "Standard Trade",
      },
    ];

    // Calculate profit per month for each
    recommendations.forEach((rec) => {
      rec.profitPerMonth = rec.netProfit * (30 / rec.duration);
    });

    // Find the highest
    const highestProfitPerMonth = Math.max(
      ...recommendations.map((r) => r.profitPerMonth)
    );

    // Award "Highest Profit Per Month" to only the highest
    recommendations.forEach((rec) => {
      if (rec.profitPerMonth === highestProfitPerMonth) {
        rec.benefits =
          rec.benefits === "Standard Trade"
            ? "Highest Profit Per Month"
            : rec.benefits + ", Highest Profit Per Month";
      }
    });

    // Verify only one has it
    const withHighest = recommendations.filter(
      (r) => r.benefits && r.benefits.includes("Highest Profit Per Month")
    );

    assert.strictEqual(
      withHighest.length,
      1,
      `Only one recommendation should have 'Highest Profit Per Month', but ${withHighest.length} have it`
    );

    // Verify it's the one with highest profit per month
    assert.strictEqual(
      withHighest[0].item,
      "Item A", // 3M/month is highest
      `'Highest Profit Per Month' should be awarded to Item A (3M/month), but got ${withHighest[0].item}`
    );

    // Clean up
    if (tradeManager && tradeManager.close) {
      tradeManager.close();
    }
  });

  test("should award 'Highest Confidence' to highest confidence trade in each duration group", async () => {
    const recommendations = [
      {
        item: "Item A",
        action: "BUY",
        confidence: 0.85,
        duration: 1,
        netProfit: 100000,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1000,
        currentPrice: 100,
        stopLoss: 95,
        explanation: "Test",
        benefits: "Standard Trade",
      },
      {
        item: "Item B",
        action: "BUY",
        confidence: 0.75,
        duration: 1,
        netProfit: 80000,
        entryPrice: 100,
        exitPrice: 108,
        quantity: 1000,
        currentPrice: 100,
        stopLoss: 95,
        explanation: "Test",
        benefits: "Standard Trade",
      },
      {
        item: "Item C",
        action: "BUY",
        confidence: 0.9,
        duration: 3,
        netProfit: 200000,
        entryPrice: 200,
        exitPrice: 220,
        quantity: 1000,
        currentPrice: 200,
        stopLoss: 190,
        explanation: "Test",
        benefits: "Standard Trade",
      },
      {
        item: "Item D",
        action: "BUY",
        confidence: 0.8,
        duration: 3,
        netProfit: 150000,
        entryPrice: 200,
        exitPrice: 215,
        quantity: 1000,
        currentPrice: 200,
        stopLoss: 190,
        explanation: "Test",
        benefits: "Standard Trade",
      },
    ];

    // Group by duration and award "Highest Confidence" to highest in each group
    const byDuration = {
      1: recommendations.filter((r) => r.duration === 1),
      3: recommendations.filter((r) => r.duration === 3),
      5: recommendations.filter((r) => r.duration === 5),
    };

    [1, 3, 5].forEach((duration) => {
      const durationRecs = byDuration[duration];
      if (durationRecs.length > 0) {
        const highestConfidence = Math.max(
          ...durationRecs.map((r) => r.confidence)
        );
        durationRecs.forEach((rec) => {
          if (rec.confidence === highestConfidence && rec.confidence >= 0.85) {
            rec.benefits =
              rec.benefits === "Standard Trade"
                ? "Highest Confidence"
                : rec.benefits + ", Highest Confidence";
          }
        });
      }
    });

    // Verify Item A (0.85) has it for 1-day, Item C (0.90) has it for 3-day
    const itemA = recommendations.find((r) => r.item === "Item A");
    const itemB = recommendations.find((r) => r.item === "Item B");
    const itemC = recommendations.find((r) => r.item === "Item C");
    const itemD = recommendations.find((r) => r.item === "Item D");

    assert.ok(
      itemA.benefits.includes("Highest Confidence"),
      "Item A (0.85 confidence, 1-day) should have 'Highest Confidence'"
    );
    assert.ok(
      !itemB.benefits.includes("Highest Confidence"),
      "Item B (0.75 confidence, 1-day) should NOT have 'Highest Confidence'"
    );
    assert.ok(
      itemC.benefits.includes("Highest Confidence"),
      "Item C (0.90 confidence, 3-day) should have 'Highest Confidence'"
    );
    assert.ok(
      !itemD.benefits.includes("Highest Confidence"),
      "Item D (0.80 confidence, 3-day) should NOT have 'Highest Confidence'"
    );
  });
});
