import { test } from 'node:test';
import assert from 'node:assert';

// Example test file to demonstrate TDD structure
// Delete this once you start writing real tests

test('example test - should pass', () => {
  assert.strictEqual(1 + 1, 2);
});

test('example test - async', async () => {
  const result = await Promise.resolve(42);
  assert.strictEqual(result, 42);
});
