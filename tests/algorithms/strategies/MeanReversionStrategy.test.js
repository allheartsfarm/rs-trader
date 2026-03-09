import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MeanReversionStrategy } from '../../../src/algorithms/strategies/MeanReversionStrategy.js';

describe('MeanReversionStrategy', () => {
  test('should identify price below mean as BUY signal', () => {
    const strategy = new MeanReversionStrategy();
    const historicalData = Array.from({ length: 20 }, (_, i) => ({
      price: 100 + (i % 3), // Mean around 101
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    const signal = strategy.analyze(historicalData, 90); // Well below mean
    
    assert.strictEqual(signal.action, 'BUY');
    assert.ok(signal.confidence > 0.5);
    assert.ok(signal.entryPrice === 90);
    assert.ok(signal.exitPrice > signal.entryPrice);
  });

  test('should identify price above mean as SELL signal', () => {
    const strategy = new MeanReversionStrategy();
    const historicalData = Array.from({ length: 20 }, (_, i) => ({
      price: 100 + (i % 3), // Mean around 101
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    const signal = strategy.analyze(historicalData, 115); // Well above mean
    
    assert.strictEqual(signal.action, 'SELL');
    assert.ok(signal.confidence > 0.5);
  });

  test('should return HOLD when price is near mean', () => {
    const strategy = new MeanReversionStrategy();
    const historicalData = Array.from({ length: 20 }, (_, i) => ({
      price: 100 + (i % 3),
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    const signal = strategy.analyze(historicalData, 101); // Near mean
    
    assert.strictEqual(signal.action, 'HOLD');
  });
});
