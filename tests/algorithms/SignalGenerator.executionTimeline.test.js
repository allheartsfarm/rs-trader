import { test, describe } from "node:test";
import assert from "node:assert";
import { SignalGenerator } from "../../src/algorithms/SignalGenerator.js";
import { Settings } from "../../src/config/Settings.js";
import { ExecutionPlan } from "../../src/algorithms/ExecutionPlan.js";

describe("SignalGenerator - Exit Price Accounting for Execution Timeline", () => {
  test("should calculate exit price accounting for buy + hold + sell timeline", () => {
    const settings = new Settings();
    settings.getConfig().trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);

    // Create historical data with price trend
    // Price increases over time, so exit price should account for when we'll actually sell
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 150 + (i * 2), // Price increases 2 gp per day
      volume: 5000,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 210; // Day 30 price
    const signal = signalGenerator.generateSignal(
      "Test Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.executionPlan) {
      const plan = signal.executionPlan;
      const totalDays = plan.totalDays; // e.g., 11 days (5 buy + 1 hold + 5 sell)
      
      // Exit price should be realistic for when we'll actually sell
      // If we start buying today (day 0), we'll finish selling on day 11
      // So exit price should account for price movement over 11 days
      
      // Calculate expected price after totalDays
      const avgDailyChange = 2; // From historical data
      const expectedPriceAfterTimeline = currentPrice + (avgDailyChange * totalDays);
      
      // Exit price should be somewhere between current and expected future price
      // It shouldn't assume we can sell immediately at the target price
      assert.ok(
        signal.exitPrice <= expectedPriceAfterTimeline * 1.1, // Allow 10% buffer
        `Exit price (${signal.exitPrice}) should account for ${totalDays}-day execution timeline. Expected max: ${expectedPriceAfterTimeline * 1.1}`
      );
    }
  });

  test("should adjust exit price based on execution plan timeline", () => {
    const settings = new Settings();
    settings.getConfig().trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);

    // Scenario: Buy over 5 days, hold 1 day, sell over 5 days = 11 days total
    // Exit price should be realistic for day 11, not day 0
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 164 + (i * 0.5), // Slow price increase
      volume: 6341,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = 179; // Day 30 price
    const signal = signalGenerator.generateSignal(
      "Water talisman",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.executionPlan && signal.quantity) {
      const plan = signal.executionPlan;
      
      // Calculate when we'll actually be selling
      // Buy: days 1-5, Hold: day 6, Sell: days 7-11
      // So we're selling on days 7-11, which is 6-10 days from now
      const sellStartDay = plan.buyDays + plan.holdDays; // Day 6
      const sellEndDay = plan.totalDays; // Day 11
      const avgSellDay = (sellStartDay + sellEndDay) / 2; // Average: day 8.5
      
      // Historical price trend
      const recentPrices = historicalData.slice(-10).map(d => d.price);
      const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
      const avgDailyPriceChange = priceChange / (recentPrices.length - 1);
      
      // Expected price when we're selling (day 8.5)
      const expectedSellPrice = currentPrice + (avgDailyPriceChange * avgSellDay);
      
      // Exit price should be close to expected sell price (within reason)
      // It should account for the fact that we're selling in the future
      const priceDiff = Math.abs(signal.exitPrice - expectedSellPrice);
      const priceDiffPercent = (priceDiff / currentPrice) * 100;
      
      // Allow up to 15% difference (accounting for volatility and profit targets)
      assert.ok(
        priceDiffPercent < 15,
        `Exit price (${signal.exitPrice}) should account for selling on day ${avgSellDay.toFixed(1)} (expected: ${expectedSellPrice.toFixed(2)}). Difference: ${priceDiffPercent.toFixed(1)}%`
      );
    }
  });

  test("should not assume immediate exit when execution plan shows multi-day sell period", () => {
    const settings = new Settings();
    settings.getConfig().trading.maxTradeDurationDays = 5;
    const signalGenerator = new SignalGenerator(settings);

    // Create data where price is volatile
    const historicalData = Array.from({ length: 30 }, (_, i) => ({
      price: 164 + Math.sin(i / 5) * 10, // Oscillating price
      volume: 6000,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
    }));

    const currentPrice = historicalData[historicalData.length - 1].price;
    const signal = signalGenerator.generateSignal(
      "Volatile Item",
      historicalData,
      currentPrice
    );

    if (signal.action === "BUY" && signal.executionPlan) {
      const plan = signal.executionPlan;
      
      // If execution plan shows we'll be selling over multiple days,
      // exit price should account for average price during sell period, not peak
      if (plan.sellDays > 1) {
        // Exit price should be realistic for the sell period, not assuming we hit peak price
        const historicalMax = Math.max(...historicalData.map(d => d.price));
        const historicalAvg = historicalData.reduce((sum, d) => sum + d.price, 0) / historicalData.length;
        
        // Exit price shouldn't assume we can sell at historical max if we're selling over multiple days
        // It should be more conservative
        assert.ok(
          signal.exitPrice <= historicalMax * 1.05, // Allow 5% above max for profit
          `Exit price (${signal.exitPrice}) should not assume peak price when selling over ${plan.sellDays} days. Historical max: ${historicalMax}`
        );
      }
    }
  });
});
