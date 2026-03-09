# Test-Driven Development (TDD) Rules

## TDD Workflow

1. **RED**: Write a failing test first
2. **GREEN**: Write the minimum code to make it pass
3. **REFACTOR**: Improve the code while keeping tests green

## Rules

- ✅ **Always write tests before implementation**
- ✅ **Run tests frequently** (`npm test` or `npm run test:watch`)
- ✅ **Keep tests simple and focused** (one assertion per test when possible)
- ✅ **Test behavior, not implementation details**
- ✅ **Use descriptive test names** that explain what is being tested
- ✅ **Keep test files next to source files** or in `tests/` directory
- ✅ **Aim for high test coverage** (80%+ is good)
- ✅ **Fix failing tests immediately** - never commit broken tests

## Test Structure

```
src/
  bot/
    TradingBot.js
    PositionManager.js
  data/
    DataFetcher.js
  algorithms/
    SignalGenerator.js
    strategies/
      MomentumStrategy.js
      MeanReversionStrategy.js

tests/
  bot/
    TradingBot.test.js
    PositionManager.test.js
  data/
    DataFetcher.test.js
  algorithms/
    SignalGenerator.test.js
    strategies/
      MomentumStrategy.test.js
      MeanReversionStrategy.test.js
```

## Running Tests

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode (recommended for TDD)
- `npm run test:coverage` - Run tests with coverage report

## Example TDD Cycle

```javascript
// 1. RED: Write failing test
test('PositionManager should limit to 3 positions for F2P', () => {
  const manager = new PositionManager(3);
  manager.addPosition({ item: 'Iron ore', quantity: 100 });
  manager.addPosition({ item: 'Coal', quantity: 50 });
  manager.addPosition({ item: 'Steel bar', quantity: 25 });
  
  assert.throws(() => {
    manager.addPosition({ item: 'Gold ore', quantity: 10 });
  }, /Maximum positions reached/);
});

// 2. GREEN: Implement minimum code
// ... implement PositionManager ...

// 3. REFACTOR: Improve code
// ... refactor while keeping tests green ...
```
