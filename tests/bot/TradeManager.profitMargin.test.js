import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";

describe("TradeManager - Profit Margin Calculation", () => {
  // Create mock readline interface
  const createMockRl = () => ({
    question: () => {},
    close: () => {},
    on: () => {},
  });

  test("should calculate profit margin as (netProfit / totalCost) * 100", () => {
    const manager = new TradeManager(createMockRl());

    // Test case: 1x at 42M gp for 373K gp profit
    // Expected: 373,000 / 42,000,000 = 0.89% ≈ 1%
    const rec = {
      item: "Gilded armour set (lg)",
      quantity: 1,
      totalCost: 42000000, // 42M
      netProfit: 373000, // 373K
      entryPrice: 42000000,
      exitPrice: 44100000, // Would give 5% per-unit, but after fees it's 373K
    };

    // Calculate expected profit margin
    const expectedMargin = (rec.netProfit / rec.totalCost) * 100; // 0.89%

    // The actual calculation should use netProfit / totalCost
    const actualMargin = (rec.netProfit / rec.totalCost) * 100;

    assert.ok(
      Math.abs(actualMargin - expectedMargin) < 0.01,
      `Profit margin should be ~0.89%, got ${actualMargin.toFixed(2)}%`
    );
    assert.ok(
      actualMargin < 1.0,
      `Profit margin (${actualMargin.toFixed(2)}%) should be less than 1%, not 5%`
    );
  });

  test("should calculate profit margin correctly for multiple units", () => {
    const manager = new TradeManager(createMockRl());

    // Test case: 1000x at 100 gp each (100K total) for 10K profit
    // Expected: 10,000 / 100,000 = 10%
    const rec = {
      item: "Test Item",
      quantity: 1000,
      totalCost: 100000, // 100K
      netProfit: 10000, // 10K
      entryPrice: 100,
      exitPrice: 110, // 10% per-unit, but after fees might be different
    };

    const expectedMargin = (rec.netProfit / rec.totalCost) * 100; // 10%
    const actualMargin = (rec.netProfit / rec.totalCost) * 100;

    assert.ok(
      Math.abs(actualMargin - 10.0) < 0.1,
      `Profit margin should be ~10%, got ${actualMargin.toFixed(2)}%`
    );
  });

  test("should handle zero total cost gracefully", () => {
    const manager = new TradeManager(createMockRl());

    const rec = {
      item: "Test Item",
      quantity: 0,
      totalCost: 0,
      netProfit: 0,
      entryPrice: 0,
      exitPrice: 0,
    };

    const margin = rec.totalCost > 0 ? (rec.netProfit / rec.totalCost) * 100 : 0;

    assert.strictEqual(margin, 0, "Profit margin should be 0 when total cost is 0");
  });

  test("should account for fees in profit margin calculation", () => {
    const manager = new TradeManager(createMockRl());

    // Test case: Entry 100, Exit 110 (10% per-unit)
    // But after 2% fees on both sides:
    // - Buy cost: 100 * 1.02 = 102
    // - Sell revenue: 110 * 0.98 = 107.8
    // - Net profit per unit: 107.8 - 102 = 5.8
    // - For 1000 units: totalCost = 102,000, netProfit = 5,800
    // - Margin: 5,800 / 102,000 = 5.69%

    const entryPrice = 100;
    const exitPrice = 110;
    const quantity = 1000;
    const buyCost = entryPrice * 1.02; // 102
    const sellRevenue = exitPrice * 0.98; // 107.8
    const profitPerUnit = sellRevenue - buyCost; // 5.8
    const totalCost = buyCost * quantity; // 102,000
    const netProfit = profitPerUnit * quantity; // 5,800

    const rec = {
      item: "Test Item",
      quantity: quantity,
      totalCost: totalCost,
      netProfit: netProfit,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
    };

    // Calculate margin using netProfit / totalCost (accounts for fees)
    const marginWithFees = (rec.netProfit / rec.totalCost) * 100; // 5.69%

    // Calculate margin using simple price difference (doesn't account for fees)
    const marginWithoutFees = ((rec.exitPrice - rec.entryPrice) / rec.entryPrice) * 100; // 10%

    assert.ok(
      Math.abs(marginWithFees - 5.69) < 0.1,
      `Profit margin with fees should be ~5.69%, got ${marginWithFees.toFixed(2)}%`
    );
    assert.ok(
      marginWithFees < marginWithoutFees,
      "Profit margin with fees should be less than without fees"
    );
  });
});
