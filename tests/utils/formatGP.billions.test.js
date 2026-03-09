import { test, describe } from "node:test";
import assert from "node:assert";
import { formatGP } from "../../src/utils/formatGP.js";

describe("formatGP - Billions Formatting", () => {
  test("should use B for amounts >= 10 billion", () => {
    assert.strictEqual(formatGP(10000000000), "10B");
    assert.strictEqual(formatGP(15000000000), "15B");
    assert.strictEqual(formatGP(99999999999), "100B");
    assert.strictEqual(formatGP(100000000000), "100B");
  });

  test("should use B with appropriate decimals for amounts >= 10B", () => {
    // Note: Since we only use B for >= 10B, and >= 10 shows 0 decimals,
    // values like 12.3B will show as "12B" (rounded)
    assert.strictEqual(formatGP(12345678900), "12B"); // 12.3B rounds to 12B (12 >= 10, so 0 decimals)
    assert.strictEqual(formatGP(50000000000), "50B"); // 50B shows 0 decimals (50 >= 10)
    assert.strictEqual(formatGP(9999999999), "10000M"); // Just under 10B, still uses M
  });

  test("should use M for amounts between 10M and 10B", () => {
    assert.strictEqual(formatGP(10000000), "10M");
    assert.strictEqual(formatGP(9999999999), "10000M"); // Just under 10B, uses M
    assert.strictEqual(formatGP(999999999), "1000M"); // Just under 1B
  });

  test("should format market cap example correctly", () => {
    // Example: 238,244,000,000 gp = 238.244B
    const marketCap = 238244000000;
    const formatted = formatGP(marketCap);
    assert.strictEqual(formatted, "238B");
  });

  test("should handle very large amounts", () => {
    assert.strictEqual(formatGP(1000000000000), "1000B");
    assert.strictEqual(formatGP(500000000000), "500B");
    assert.strictEqual(formatGP(123456789000), "123B"); // 123 >= 100, so 0 decimals
    assert.strictEqual(formatGP(238244000000), "238B"); // Market cap example (238 >= 100, so 0 decimals)
  });
});
