import { test, describe } from "node:test";
import assert from "node:assert";
import { Settings } from "../../src/config/Settings.js";

describe("Settings - Trade Duration", () => {
  test("should have maxTradeDurationDays in default settings", () => {
    const settings = new Settings();
    const config = settings.getConfig();

    assert.ok(typeof config.trading.maxTradeDurationDays === "number");
    assert.ok(config.trading.maxTradeDurationDays > 0);
  });

  test("should load maxTradeDurationDays from settings file", async () => {
    const fs = await import("fs/promises");
    const testSettingsPath = "test-settings-duration.json";
    const testSettings = {
      trading: {
        maxTradeDurationDays: 2,
      },
    };

    await fs.writeFile(
      testSettingsPath,
      JSON.stringify(testSettings, null, 2)
    );

    const settings = new Settings(testSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    assert.strictEqual(config.trading.maxTradeDurationDays, 2);

    // Cleanup
    await fs.unlink(testSettingsPath);
  });

  test("should validate maxTradeDurationDays is positive", () => {
    const settings = new Settings();
    const config = settings.getConfig();

    assert.ok(config.trading.maxTradeDurationDays > 0);
    assert.ok(config.trading.maxTradeDurationDays <= 7); // Reasonable max
  });
});
