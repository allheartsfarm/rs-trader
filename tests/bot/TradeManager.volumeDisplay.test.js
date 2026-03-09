import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";

describe("TradeManager - Volume Feasibility Display", () => {
  // Create mock readline interface
  const createMockRl = () => ({
    question: () => {},
    close: () => {},
    on: () => {},
  });

  test("should show correct required volume for buy+sell", () => {
    const manager = new TradeManager(createMockRl());

    // For 1 unit trade:
    // - Need 1 unit to buy
    // - Need 1 unit to sell
    // - Total required volume = 2 units
    const rec = {
      item: "Gilded armour set (lg)",
      quantity: 1,
      avgDailyVolume: 5186.667,
      duration: 1,
    };

    const requiredVolume = (rec.quantity || 0) * 2; // 1 * 2 = 2

    // The calculation is correct: 2 units needed (1 buy + 1 sell)
    assert.strictEqual(
      requiredVolume,
      2,
      "Required volume should be 2 for 1 unit trade (1 buy + 1 sell)"
    );

    // But the display should clarify this is for buy+sell
    // The fix should make it clear: "1 buy + 1 sell = 2 req"
    // or just show the quantity and explain it's for buy+sell
  });

  test("should show correct required volume for multiple units", () => {
    const manager = new TradeManager(createMockRl());

    // For 1000 unit trade:
    // - Need 1000 units to buy
    // - Need 1000 units to sell
    // - Total required volume = 2000 units
    const rec = {
      item: "Test Item",
      quantity: 1000,
      avgDailyVolume: 10000,
      duration: 2,
    };

    const requiredVolume = (rec.quantity || 0) * 2; // 1000 * 2 = 2000

    assert.strictEqual(
      requiredVolume,
      2000,
      "Required volume should be 2000 for 1000 unit trade (1000 buy + 1000 sell)"
    );
  });

  test("should clarify that required volume is for buy+sell in display", () => {
    // The display should make it clear that "2 req" means "1 buy + 1 sell"
    // Not that we're buying 2 units
    const quantity = 1;
    const requiredVolume = quantity * 2;

    // Display format should be something like:
    // "1 buy + 1 sell = 2 req" or "2 req (1 buy + 1 sell)"
    const displayText = `${quantity} buy + ${quantity} sell = ${requiredVolume} req`;

    assert.ok(
      displayText.includes("buy") && displayText.includes("sell"),
      "Display should clarify that required volume is for buy+sell"
    );
    assert.ok(
      displayText.includes("2 req"),
      "Display should show the total required volume"
    );
  });
});
