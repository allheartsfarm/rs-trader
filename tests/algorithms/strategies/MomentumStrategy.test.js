import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MomentumStrategy } from '../../../src/algorithms/strategies/MomentumStrategy.js';

describe('MomentumStrategy', () => {
  test('should identify strong upward momentum as BUY signal', () => {
    const strategy = new MomentumStrategy();
    const historicalData = [
      { price: 100, timestamp: new Date('2024-01-01') },
      { price: 102, timestamp: new Date('2024-01-02') },
      { price: 105, timestamp: new Date('2024-01-03') },
      { price: 108, timestamp: new Date('2024-01-04') },
      { price: 110, timestamp: new Date('2024-01-05') },
      { price: 112, timestamp: new Date('2024-01-06') },
      { price: 115, timestamp: new Date('2024-01-07') },
      { price: 118, timestamp: new Date('2024-01-08') },
      { price: 120, timestamp: new Date('2024-01-09') },
      { price: 125, timestamp: new Date('2024-01-10') }
    ];

    const signal = strategy.analyze(historicalData, 125);
    
    assert.strictEqual(signal.action, 'BUY');
    assert.ok(signal.confidence > 0.5);
    assert.ok(signal.entryPrice > 0);
    assert.ok(signal.exitPrice > signal.entryPrice);
  });

  test('should identify strong downward momentum as SELL signal', () => {
    const strategy = new MomentumStrategy();
    const historicalData = [
      { price: 120, timestamp: new Date('2024-01-01') },
      { price: 118, timestamp: new Date('2024-01-02') },
      { price: 115, timestamp: new Date('2024-01-03') },
      { price: 112, timestamp: new Date('2024-01-04') },
      { price: 110, timestamp: new Date('2024-01-05') },
      { price: 108, timestamp: new Date('2024-01-06') },
      { price: 105, timestamp: new Date('2024-01-07') },
      { price: 102, timestamp: new Date('2024-01-08') },
      { price: 100, timestamp: new Date('2024-01-09') },
      { price: 95, timestamp: new Date('2024-01-10') }
    ];

    const signal = strategy.analyze(historicalData, 95);
    
    assert.strictEqual(signal.action, 'SELL');
    assert.ok(signal.confidence > 0.5);
  });

  test('should return HOLD for insufficient data', () => {
    const strategy = new MomentumStrategy();
    const historicalData = [
      { price: 100, timestamp: new Date('2024-01-01') },
      { price: 105, timestamp: new Date('2024-01-02') }
    ];

    const signal = strategy.analyze(historicalData, 105);
    
    assert.strictEqual(signal.action, 'HOLD');
    assert.strictEqual(signal.confidence, 0);
  });
});
