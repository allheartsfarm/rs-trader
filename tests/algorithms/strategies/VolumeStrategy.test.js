import { test, describe } from 'node:test';
import assert from 'node:assert';
import { VolumeStrategy } from '../../../src/algorithms/strategies/VolumeStrategy.js';

describe('VolumeStrategy', () => {
  test('should identify high volume with price increase as BUY signal', () => {
    const strategy = new VolumeStrategy();
    const historicalData = Array.from({ length: 10 }, (_, i) => ({
      price: 100 + i * 2,
      volume: 1000 + i * 100,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    // Last entry has high volume
    historicalData[9].volume = 5000; // Much higher than average

    const signal = strategy.analyze(historicalData, 120);
    
    assert.strictEqual(signal.action, 'BUY');
    assert.ok(signal.confidence > 0.6);
  });

  test('should identify high volume with price decrease as SELL signal', () => {
    const strategy = new VolumeStrategy();
    const historicalData = Array.from({ length: 10 }, (_, i) => ({
      price: 120 - i * 2,
      volume: 1000 + i * 100,
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    historicalData[9].volume = 5000;

    const signal = strategy.analyze(historicalData, 100);
    
    assert.strictEqual(signal.action, 'SELL');
    assert.ok(signal.confidence > 0.6);
  });

  test('should return HOLD for low volume', () => {
    const strategy = new VolumeStrategy();
    const historicalData = Array.from({ length: 10 }, (_, i) => ({
      price: 100 + i,
      volume: 500, // Low volume
      timestamp: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
    }));

    const signal = strategy.analyze(historicalData, 110);
    
    assert.strictEqual(signal.action, 'HOLD');
  });
});
