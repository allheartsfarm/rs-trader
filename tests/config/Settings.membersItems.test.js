import { test, describe } from "node:test";
import assert from "node:assert";
import { Settings } from "../../src/config/Settings.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Settings - Members Items Toggle", () => {
  test("should default to F2P only (includeMembersItems: false)", async () => {
    const defaultSettingsPath = path.join(__dirname, "..//.cache/nonexistent-defaults-test.json");
    const settings = new Settings(defaultSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    assert.strictEqual(
      config.data.includeMembersItems,
      false,
      "Should default to F2P only (includeMembersItems: false)"
    );
  });

  test("should allow setting includeMembersItems to true", async () => {
    const testSettingsPath = path.join(__dirname, "../../.cache/test-settings.json");
    const settings = new Settings(testSettingsPath);
    
    // Set includeMembersItems to true
    await settings.load();
    settings.getConfig().data.includeMembersItems = true;
    await settings.save();

    // Reload and verify
    const settings2 = new Settings(testSettingsPath);
    await settings2.load();
    const config = settings2.getConfig();

    assert.strictEqual(
      config.data.includeMembersItems,
      true,
      "Should persist includeMembersItems setting"
    );

    // Cleanup
    try {
      await fs.unlink(testSettingsPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test("should merge includeMembersItems from user settings", async () => {
    const testSettingsPath = path.join(__dirname, "../../.cache/test-settings.json");
    
    // Create a settings file with includeMembersItems: true
    const userSettings = {
      data: {
        includeMembersItems: true,
      },
    };
    await fs.writeFile(testSettingsPath, JSON.stringify(userSettings, null, 2));

    const settings = new Settings(testSettingsPath);
    await settings.load();
    const config = settings.getConfig();

    assert.strictEqual(
      config.data.includeMembersItems,
      true,
      "Should merge includeMembersItems from user settings"
    );

    // Cleanup
    try {
      await fs.unlink(testSettingsPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});
