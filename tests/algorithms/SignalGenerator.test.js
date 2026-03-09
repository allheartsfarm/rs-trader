import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SignalGenerator } from '../../src/algorithms/SignalGenerator.js';

describe('SignalGenerator', () => {
  test('should initialize with strategies', () => {
    const generator = new SignalGenerator();
    assert.ok(Array.isArray(generator.strategies));
  });

  test('should generate buy signal', () => {
    const generator = new SignalGenerator();
    const historicalData = [
      { price: 100, timestamp: new Date('2024-01-01') },
      { price: 105, timestamp: new Date('2024-01-02') },
      { price: 110, timestamp: new Date('2024-01-03') },
      { price: 115, timestamp: new Date('2024-01-04') },
      { price: 120, timestamp: new Date('2024-01-05') }
    ];

    const signal = generator.generateSignal('Iron ore', historicalData, 120);
    
    assert.ok(signal);
    assert.ok(['BUY', 'SELL', 'HOLD'].includes(signal.action));
    assert.ok(typeof signal.confidence === 'number');
    assert.ok(signal.confidence >= 0 && signal.confidence <= 1);
  });

  test('should include entry and exit prices in signal', () => {
    const generator = new SignalGenerator();
    const historicalData = [
      { price: 100, timestamp: new Date('2024-01-01') },
      { price: 105, timestamp: new Date('2024-01-02') },
      { price: 110, timestamp: new Date('2024-01-03') }
    ];

    const signal = generator.generateSignal('Iron ore', historicalData, 110);
    
    if (signal.action === 'BUY') {
      assert.ok(typeof signal.entryPrice === 'number');
      assert.ok(typeof signal.exitPrice === 'number');
      assert.ok(signal.exitPrice > signal.entryPrice);
    }
  });

  test('should calculate recommended quantity', () => {
    const generator = new SignalGenerator();
    const historicalData = [
      { price: 100, timestamp: new Date('2024-01-01') },
      { price: 105, timestamp: new Date('2024-01-02') }
    ];

    const signal = generator.generateSignal('Iron ore', historicalData, 105);
    
    if (signal.action === 'BUY') {
      assert.ok(typeof signal.quantity === 'number');
      assert.ok(signal.quantity > 0);
    }
  });

  test('should generate signals for multiple items', () => {
    const generator = new SignalGenerator();
    const items = [
      { name: 'Iron ore', data: [{ price: 100, timestamp: new Date() }], currentPrice: 100 },
      { name: 'Coal', data: [{ price: 200, timestamp: new Date() }], currentPrice: 200 }
    ];

    const signals = generator.generateSignalsForItems(items);
    
    assert.ok(Array.isArray(signals));
    assert.strictEqual(signals.length, 2);
    assert.ok(signals.every(s => s.hasOwnProperty('item') && s.hasOwnProperty('action')));
  });
});
