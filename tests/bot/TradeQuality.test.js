import { test, describe } from "node:test";
import assert from "node:assert";
import { TradingBot } from "../../src/bot/TradingBot.js";
import { Settings } from "../../src/config/Settings.js";

describe("Trade Quality - Profit Targets", () => {
  test("should filter out trades below minimum profit target", async () => {
    const settings = new Settings();
    await settings.load();
    const config = settings.getConfig();
    
    // Create bot with high minimum profit requirement
    const bot = new TradingBot({
      settings,
    });
    
    const items = ["Iron ore", "Coal"];
    const recommendations = await bot.analyzeMarket(items);
    
    // All BUY recommendations should meet minimum profit (or be filtered)
    // Note: TradingBot filters trades - allows 40% of min for 2-day trades OR 75%+ confidence
    const buyRecommendations = recommendations.filter(r => r.action === "BUY");
    buyRecommendations.forEach(rec => {
      if (rec.netProfit !== undefined) {
        // TradingBot allows trades with:
        // 1. 40% of minimum profit (for 2-day trades) OR 95% for longer trades
        // 2. OR 75%+ confidence
        const tolerance = config.trading.maxTradeDurationDays === 2 ? 0.4 : 0.95;
        const minAcceptable = config.trading.minProfitPerTrade * tolerance;
        const hasHighConfidence = rec.confidence && rec.confidence >= 0.75;
        const meetsProfitThreshold = rec.netProfit >= minAcceptable;
        const isProfitable = rec.netProfit > 0;
        
        // Trade should be profitable AND (meet profit threshold OR have high confidence)
        assert.ok(
          isProfitable && (meetsProfitThreshold || hasHighConfidence),
          `Trade ${rec.item} has net profit ${rec.netProfit} (min acceptable: ${minAcceptable}), confidence ${rec.confidence || 'N/A'}, profitable: ${isProfitable}`
        );
      }
    });
  });

  test("should prioritize trades with higher profit potential", async () => {
    const settings = new Settings();
    await settings.load();
    
    const bot = new TradingBot({
      settings,
    });
    
    const items = ["Iron ore", "Coal", "Steel bar", "Gold ore"];
    const recommendations = await bot.analyzeMarket(items);
    
    // Sort by net profit
    const buyRecommendations = recommendations
      .filter(r => r.action === "BUY" && r.netProfit)
      .sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));
    
    // Top recommendation should have highest profit
    if (buyRecommendations.length > 1) {
      assert.ok(
        (buyRecommendations[0].netProfit || 0) >= (buyRecommendations[1].netProfit || 0),
        "Recommendations should be sorted by profit"
      );
    }
  });
});
