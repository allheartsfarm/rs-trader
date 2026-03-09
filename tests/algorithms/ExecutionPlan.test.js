import { test, describe } from "node:test";
import assert from "node:assert";
import { ExecutionPlan } from "../../src/algorithms/ExecutionPlan.js";

describe("ExecutionPlan", () => {
  test("should calculate execution plan for small trade", () => {
    const plan = ExecutionPlan.calculateExecutionPlan({
      quantity: 1000,
      avgDailyVolume: 10000,
      maxTradeDurationDays: 5,
      entryPrice: 100,
      exitPrice: 110,
    });

    assert.ok(plan.buyDays > 0, "Should have buy days");
    assert.ok(plan.sellDays > 0, "Should have sell days");
    assert.ok(plan.totalDays > 0, "Should have total days");
    assert.ok(plan.plan.length > 0, "Should have plan description");
    assert.ok(plan.executionRisk === "low" || plan.executionRisk === "medium" || plan.executionRisk === "high");
  });

  test("should calculate execution plan for large trade", () => {
    const plan = ExecutionPlan.calculateExecutionPlan({
      quantity: 15000,
      avgDailyVolume: 6000,
      maxTradeDurationDays: 5,
      entryPrice: 567,
      exitPrice: 626,
    });

    assert.ok(plan.buyDays > 0, "Should have buy days");
    assert.ok(plan.sellDays > 0, "Should have sell days");
    assert.ok(plan.totalDays >= plan.buyDays + plan.sellDays, "Total should be at least buy + sell");
    assert.ok(plan.buyVolumePercent > 0, "Should have buy volume percent");
    assert.ok(plan.sellVolumePercent > 0, "Should have sell volume percent");
  });

  test("should adjust confidence for execution risk", () => {
    const lowRiskConfidence = ExecutionPlan.adjustConfidenceForExecutionRisk(0.8, "low");
    const mediumRiskConfidence = ExecutionPlan.adjustConfidenceForExecutionRisk(0.8, "medium");
    const highRiskConfidence = ExecutionPlan.adjustConfidenceForExecutionRisk(0.8, "high");

    assert.strictEqual(lowRiskConfidence, 0.8, "Low risk should not reduce confidence");
    assert.ok(mediumRiskConfidence < 0.8, "Medium risk should reduce confidence");
    assert.ok(highRiskConfidence < mediumRiskConfidence, "High risk should reduce confidence more");
    assert.strictEqual(mediumRiskConfidence, 0.76, "Medium risk should reduce by 5%");
    assert.strictEqual(highRiskConfidence, 0.68, "High risk should reduce by 15%");
  });

  test("should handle insufficient data", () => {
    const plan = ExecutionPlan.calculateExecutionPlan({
      quantity: 0,
      avgDailyVolume: 0,
      maxTradeDurationDays: 5,
      entryPrice: 100,
      exitPrice: 110,
    });

    assert.strictEqual(plan.buyDays, 0);
    assert.strictEqual(plan.totalDays, 0);
    assert.ok(plan.plan.includes("Insufficient"));
  });
});
