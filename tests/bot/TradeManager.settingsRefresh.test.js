import { test, describe } from "node:test";
import assert from "node:assert";
import { TradeManager } from "../../src/bot/TradeManager.js";
import { Settings } from "../../src/config/Settings.js";
import readline from "readline";

describe("TradeManager - Settings Refresh", () => {
  let manager;
  let mockRl;
  let mockQuestion;
  let questionCallbacks;

  function createMockReadline() {
    questionCallbacks = [];
    mockQuestion = (query, callback) => {
      questionCallbacks.push({ query, callback });
    };

    mockRl = {
      question: mockQuestion,
      close: () => {},
      on: () => {},
      removeListener: () => {},
    };

    return mockRl;
  }

  test.beforeEach(() => {
    manager = new TradeManager(createMockReadline());
  });

  test("showSettingsMenu should return true when members items setting is toggled", async () => {
    const settings = new Settings();
    const config = settings.getConfig();
    config.data.includeMembersItems = false;

    // Simulate user toggling members items (M) then quitting (Q)
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // First call: user presses 'M' to toggle
        setTimeout(() => callback("M"), 10);
      } else if (callCount === 2) {
        // Second call: user presses 'Q' to quit
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const settingsChanged = await manager.showSettingsMenu(settings);

    assert.strictEqual(settingsChanged, true, "Settings should be marked as changed");
    assert.strictEqual(
      settings.getConfig().data.includeMembersItems,
      true,
      "Members items should be enabled"
    );
  });

  test("showSettingsMenu should return false when no settings are changed", async () => {
    const settings = new Settings();
    const config = settings.getConfig();
    config.data.includeMembersItems = false;

    // Simulate user just quitting (Q) without changing anything
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // User presses 'Q' to quit without changing settings
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const settingsChanged = await manager.showSettingsMenu(settings);

    assert.strictEqual(settingsChanged, false, "Settings should not be marked as changed");
    assert.strictEqual(
      settings.getConfig().data.includeMembersItems,
      false,
      "Members items should remain disabled"
    );
  });

  test("showSettingsMenu should return true when toggling multiple times", async () => {
    const settings = new Settings();
    const config = settings.getConfig();
    config.data.includeMembersItems = false;

    // Simulate user toggling members items twice (M, M) then quitting (Q)
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // First toggle: M
        setTimeout(() => callback("M"), 10);
      } else if (callCount === 2) {
        // Second toggle: M
        setTimeout(() => callback("M"), 10);
      } else if (callCount === 3) {
        // Quit: Q
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const settingsChanged = await manager.showSettingsMenu(settings);

    assert.strictEqual(settingsChanged, true, "Settings should be marked as changed");
    // After two toggles, it should be back to false
    assert.strictEqual(
      settings.getConfig().data.includeMembersItems,
      false,
      "Members items should be disabled after two toggles"
    );
  });

  test("promptForApproval should return refresh flag when settings change", async () => {
    const settings = new Settings();
    const config = settings.getConfig();
    config.data.includeMembersItems = false;
    const recommendations = [
      { item: "Test Item", confidence: 0.8, action: "BUY" },
    ];

    // Simulate user pressing 'S' for settings, then 'M' to toggle, then 'Q' to quit settings
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // User presses 'S' for settings
        setTimeout(() => callback("S"), 10);
      } else if (callCount === 2) {
        // In settings menu, user presses 'M' to toggle
        setTimeout(() => callback("M"), 10);
      } else if (callCount === 3) {
        // In settings menu, user presses 'Q' to quit
        setTimeout(() => callback("Q"), 10);
      } else if (callCount === 4) {
        // Back in main menu, user presses 'Q' to quit
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const result = await manager.promptForApproval(recommendations, false, settings);

    // Result should be an object with refresh flag
    assert.strictEqual(
      result.needsRefresh,
      true,
      "Should indicate refresh is needed"
    );
    assert.strictEqual(
      result.approved.length,
      0,
      "No trades should be approved"
    );
  });

  test("promptForApproval should return no refresh flag when settings don't change", async () => {
    const settings = new Settings();
    const config = settings.getConfig();
    config.data.includeMembersItems = false;
    const recommendations = [
      { item: "Test Item", confidence: 0.8, action: "BUY" },
    ];

    // Simulate user pressing 'S' for settings, then 'Q' to quit without changing
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // User presses 'S' for settings
        setTimeout(() => callback("S"), 10);
      } else if (callCount === 2) {
        // In settings menu, user presses 'Q' to quit without changing
        setTimeout(() => callback("Q"), 10);
      } else if (callCount === 3) {
        // Back in main menu, user presses 'Q' to quit
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const result = await manager.promptForApproval(recommendations, false, settings);

    // Result should indicate no refresh needed
    assert.strictEqual(
      result.needsRefresh,
      false,
      "Should not indicate refresh is needed"
    );
    assert.strictEqual(
      result.approved.length,
      0,
      "No trades should be approved"
    );
  });

  test("promptForApproval should return approved trades when not refreshing", async () => {
    const settings = new Settings();
    const recommendations = [
      { item: "Test Item 1", confidence: 0.8, action: "BUY" },
      { item: "Test Item 2", confidence: 0.7, action: "BUY" },
    ];

    // Simulate user approving trade 0, then quitting
    let callCount = 0;
    mockQuestion = (query, callback) => {
      callCount++;
      if (callCount === 1) {
        // User approves trade 0
        setTimeout(() => callback("A0"), 10);
      } else if (callCount === 2) {
        // User quits
        setTimeout(() => callback("Q"), 10);
      }
    };
    manager.rl.question = mockQuestion;

    const result = await manager.promptForApproval(recommendations, false, settings);

    assert.strictEqual(
      result.needsRefresh,
      false,
      "Should not indicate refresh is needed"
    );
    assert.strictEqual(
      result.approved.length,
      1,
      "One trade should be approved"
    );
    assert.strictEqual(
      result.approved[0].item,
      "Test Item 1",
      "Correct trade should be approved"
    );
  });
});
