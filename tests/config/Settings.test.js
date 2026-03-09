import { test, describe } from "node:test";
import assert from "node:assert";
import { Settings } from "../../src/config/Settings.js";
import fs from "fs/promises";
import path from "path";

describe("Settings", () => {
  test("should load default settings if file doesn't exist", () => {
    const settings = new Settings("nonexistent.json");
    const config = settings.getConfig();

    assert.ok(config);
    assert.ok(typeof config.trading === "object");
    assert.ok(typeof config.trading.minProfitPerTrade === "number");
    assert.ok(typeof config.trading.targetProfitPerTrade === "number");
  });

  test("should load settings from JSON file", async () => {
    const testSettingsPath = "test-settings.json";
    const testSettings = {
      trading: {
        minProfitPerTrade: 500000,
        targetProfitPerTrade: 1000000,
        baseCapital: 5000000,
      },
    };

    await fs.writeFile(
      testSettingsPath,
      JSON.stringify(testSettings, null, 2)
    );

    const settings = new Settings(testSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    assert.strictEqual(config.trading.minProfitPerTrade, 500000);
    assert.strictEqual(config.trading.targetProfitPerTrade, 1000000);
    assert.strictEqual(config.trading.baseCapital, 5000000);

    // Cleanup
    await fs.unlink(testSettingsPath);
  });

  test("should merge user settings with defaults", async () => {
    const testSettingsPath = "test-settings-partial.json";
    const testSettings = {
      trading: {
        minProfitPerTrade: 600000,
      },
    };

    await fs.writeFile(
      testSettingsPath,
      JSON.stringify(testSettings, null, 2)
    );

    const settings = new Settings(testSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    // User setting should override
    assert.strictEqual(config.trading.minProfitPerTrade, 600000);
    // Default should still be present
    assert.ok(typeof config.trading.targetProfitPerTrade === "number");

    // Cleanup
    await fs.unlink(testSettingsPath);
  });

  test("should validate settings values", async () => {
    const testSettingsPath = "test-settings-invalid.json";
    const testSettings = {
      trading: {
        minProfitPerTrade: -1000, // Invalid negative value
      },
    };

    await fs.writeFile(
      testSettingsPath,
      JSON.stringify(testSettings, null, 2)
    );

    const settings = new Settings(testSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    // Should use default if invalid
    assert.ok(config.trading.minProfitPerTrade > 0);

    // Cleanup
    await fs.unlink(testSettingsPath);
  });

  test("should provide access to trading parameters", () => {
    const settings = new Settings();
    const config = settings.getConfig();

    assert.ok(config.trading.minProfitPerTrade >= 500000);
    assert.ok(config.trading.targetProfitPerTrade >= 1000000);
    assert.ok(config.trading.baseCapital > 0);
    assert.ok(config.trading.maxPositions > 0);
  });
});
