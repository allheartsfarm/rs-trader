import { test, describe } from "node:test";
import assert from "node:assert";
import { calculateGEFee, calculateNetProfit, calculateTotalCost } from "../../src/utils/GEFee.js";

describe("Grand Exchange Fee Calculations", () => {
  test("should calculate 2% fee for items above 50 GP", () => {
    const price = 100;
    const quantity = 1000;
    const totalCost = price * quantity;
    const fee = calculateGEFee(totalCost, price);
    
    assert.strictEqual(fee, totalCost * 0.02); // 2% fee
    assert.strictEqual(fee, 2000);
  });

  test("should calculate no fee for items at or below 50 GP", () => {
    const price = 50;
    const quantity = 1000;
    const totalCost = price * quantity;
    const fee = calculateGEFee(totalCost, price);
    
    assert.strictEqual(fee, 0); // No fee
  });

  test("should calculate net profit after fees", () => {
    const entryPrice = 100;
    const exitPrice = 110;
    const quantity = 1000;
    
    const netProfit = calculateNetProfit(entryPrice, exitPrice, quantity);
    
    // Gross profit: (110 - 100) * 1000 = 10,000
    // Entry fee: 100 * 1000 * 0.02 = 2,000
    // Exit fee: 110 * 1000 * 0.02 = 2,200
    // Net profit: 10,000 - 2,000 - 2,200 = 5,800
    assert.strictEqual(netProfit, 5800);
  });

  test("should handle items below 50 GP fee threshold", () => {
    const entryPrice = 40;
    const exitPrice = 45;
    const quantity = 1000;
    
    const netProfit = calculateNetProfit(entryPrice, exitPrice, quantity);
    
    // No fees for items <= 50 GP
    // Gross profit: (45 - 40) * 1000 = 5,000
    assert.strictEqual(netProfit, 5000);
  });
});
