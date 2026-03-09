import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";
import { Settings } from "../../src/config/Settings.js";
import readline from "readline";

describe("TradeManager - Settings Menu", () => {
  test("should display Members Items toggle in settings menu", async () => {
    const mockRl = {
      question: (prompt, callback) => {
        // Simulate user pressing 'Q' to quit
        setTimeout(() => callback("Q"), 10);
      },
      close: () => {},
    };

    const manager = new TradeManager(mockRl);
    const settings = new Settings();
    await settings.load();

    // Capture console output
    const originalLog = console.log;
    let output = "";
    console.log = (...args) => {
      output += args.join(" ") + "\n";
    };

    try {
      await manager.showSettingsMenu(settings);
    } finally {
      console.log = originalLog;
      manager.close();
    }

    // Verify settings menu displays Members Items
    assert.ok(
      output.includes("Members Items") || output.includes("members"),
      "Settings menu should display Members Items toggle"
    );
  });

  test("should toggle Members Items setting", async () => {
    const settings = new Settings();
    await settings.load();
    const initialValue = settings.getConfig().data.includeMembersItems;

    // Create a mock that tracks calls
    let callCount = 0;
    const mockRl = {
      question: (prompt, callback) => {
        callCount++;
        if (callCount === 1) {
          // First call: user presses 'M' to toggle
          setTimeout(() => callback("M"), 10);
        } else {
          // Second call: user presses 'Q' to quit
          setTimeout(() => callback("Q"), 10);
        }
      },
      close: () => {},
    };

    const manager = new TradeManager(mockRl);

    try {
      await manager.showSettingsMenu(settings);
    } finally {
      manager.close();
    }

    // Verify setting was toggled
    const newValue = settings.getConfig().data.includeMembersItems;
    assert.strictEqual(
      newValue,
      !initialValue,
      "Members Items setting should be toggled"
    );

    // Toggle back to original
    settings.getConfig().data.includeMembersItems = initialValue;
    await settings.save();
  });

  test("should default to F2P only (includeMembersItems: false)", async () => {
    const settings = new Settings();
    await settings.load();
    const config = settings.getConfig();

    assert.strictEqual(
      config.data.includeMembersItems,
      false,
      "Should default to F2P only"
    );
  });
});
