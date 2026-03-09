import { test, describe } from "node:test";
import assert from "node:assert";
import { PositionManager } from "../../src/bot/PositionManager.js";

describe("PositionManager", () => {
  test("should initialize with max positions limit", () => {
    const manager = new PositionManager(3);
    assert.strictEqual(manager.maxPositions, 3);
    assert.strictEqual(manager.getPositionCount(), 0);
  });

  test("should add positions up to the limit", () => {
    const manager = new PositionManager(3);

    manager.addPosition({ item: "Iron ore", quantity: 100, buyPrice: 100 });
    assert.strictEqual(manager.getPositionCount(), 1);

    manager.addPosition({ item: "Coal", quantity: 50, buyPrice: 200 });
    assert.strictEqual(manager.getPositionCount(), 2);

    manager.addPosition({ item: "Steel bar", quantity: 25, buyPrice: 500 });
    assert.strictEqual(manager.getPositionCount(), 3);
  });

  test("should throw error when exceeding max positions (F2P limit)", () => {
    const manager = new PositionManager(3);

    manager.addPosition({ item: "Iron ore", quantity: 100, buyPrice: 100 });
    manager.addPosition({ item: "Coal", quantity: 50, buyPrice: 200 });
    manager.addPosition({ item: "Steel bar", quantity: 25, buyPrice: 500 });

    assert.throws(() => {
      manager.addPosition({ item: "Gold ore", quantity: 10, buyPrice: 300 });
    }, /Maximum positions reached/);
  });

  test("should remove positions", () => {
    const manager = new PositionManager(3);

    manager.addPosition({ item: "Iron ore", quantity: 100, buyPrice: 100 });
    manager.addPosition({ item: "Coal", quantity: 50, buyPrice: 200 });

    assert.strictEqual(manager.getPositionCount(), 2);

    manager.removePosition("Iron ore");
    assert.strictEqual(manager.getPositionCount(), 1);
    assert.strictEqual(manager.hasPosition("Iron ore"), false);
    assert.strictEqual(manager.hasPosition("Coal"), true);
  });

  test("should check if position exists", () => {
    const manager = new PositionManager(3);

    manager.addPosition({ item: "Iron ore", quantity: 100, buyPrice: 100 });

    assert.strictEqual(manager.hasPosition("Iron ore"), true);
    assert.strictEqual(manager.hasPosition("Coal"), false);
  });

  test("should get position details", () => {
    const manager = new PositionManager(3);
    const position = { item: "Iron ore", quantity: 100, buyPrice: 100 };

    manager.addPosition(position);

    const retrieved = manager.getPosition("Iron ore");
    assert.strictEqual(retrieved.item, position.item);
    assert.strictEqual(retrieved.quantity, position.quantity);
    assert.strictEqual(retrieved.buyPrice, position.buyPrice);
    assert.ok(retrieved.addedAt instanceof Date);
  });

  test("should get all positions", () => {
    const manager = new PositionManager(3);

    manager.addPosition({ item: "Iron ore", quantity: 100, buyPrice: 100 });
    manager.addPosition({ item: "Coal", quantity: 50, buyPrice: 200 });

    const positions = manager.getAllPositions();
    assert.strictEqual(positions.length, 2);
  });
});
