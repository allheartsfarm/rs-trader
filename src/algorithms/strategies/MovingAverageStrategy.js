/**
 * MovingAverageStrategy - Uses moving average crossovers to identify trends
 */
export class MovingAverageStrategy {
  constructor(config = null) {
    this.name = "MovingAverage";
    this.config = config || { shortPeriod: 10, longPeriod: 20 };
    this.shortPeriod = this.config.shortPeriod;
    this.longPeriod = this.config.longPeriod;
  }

  /**
   * Calculate Simple Moving Average
   * @private
   */
  calculateSMA(prices, period) {
    if (prices.length < period) {
      return null;
    }
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  }

  /**
   * Analyze price data for moving average signals
   * @param {Array} historicalData - Historical price data
   * @param {number} currentPrice - Current market price
   * @param {Object} options - Strategy options (e.g., maxTradeDurationDays)
   */
  analyze(historicalData, currentPrice, options = {}) {
    if (historicalData.length < this.longPeriod) {
      return {
        strategy: this.name,
        action: "HOLD",
        confidence: 0,
      };
    }

    const prices = historicalData.map((d) => d.price);
    prices.push(currentPrice);

    const shortMA = this.calculateSMA(prices, this.shortPeriod);
    const longMA = this.calculateSMA(prices, this.longPeriod);

    if (!shortMA || !longMA) {
      return {
        strategy: this.name,
        action: "HOLD",
        confidence: 0,
      };
    }

    const previousPrices = prices.slice(0, -1);
    const prevShortMA = this.calculateSMA(previousPrices, this.shortPeriod);
    const prevLongMA = this.calculateSMA(previousPrices, this.longPeriod);

    // Golden Cross: Short MA crosses above Long MA
    if (shortMA > longMA && prevShortMA <= prevLongMA) {
      let exitPrice = currentPrice * 1.15; // Default 15% profit
      
      // Adjust for quick flips
      if (options.maxTradeDurationDays) {
        const recentDays = Math.min(options.maxTradeDurationDays, historicalData.length - 1);
        if (recentDays > 0) {
          const recent = historicalData.slice(-recentDays);
          const avgDailyChange = recent.reduce((sum, d, i) => {
            if (i > 0) {
              return sum + Math.abs(d.price - recent[i - 1].price) / recent[i - 1].price;
            }
            return sum;
          }, 0) / (recentDays - 1);
          
          const maxRealisticProfit = avgDailyChange * options.maxTradeDurationDays * 1.2;
          exitPrice = currentPrice * (1 + Math.min(0.15, maxRealisticProfit));
        }
      }
      
      return {
        strategy: this.name,
        action: "BUY",
        confidence: 0.75,
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: currentPrice * 0.95,
      };
    }

    // Death Cross: Short MA crosses below Long MA
    if (shortMA < longMA && prevShortMA >= prevLongMA) {
      return {
        strategy: this.name,
        action: "SELL",
        confidence: 0.75,
      };
    }

    // Price above both MAs - bullish
    if (currentPrice > shortMA && currentPrice > longMA && shortMA > longMA) {
      let exitPrice = currentPrice * 1.12; // Default 12% profit
      
      // Adjust for quick flips
      if (options.maxTradeDurationDays) {
        const recentDays = Math.min(options.maxTradeDurationDays, historicalData.length - 1);
        if (recentDays > 0) {
          const recent = historicalData.slice(-recentDays);
          const avgDailyChange = recent.reduce((sum, d, i) => {
            if (i > 0) {
              return sum + Math.abs(d.price - recent[i - 1].price) / recent[i - 1].price;
            }
            return sum;
          }, 0) / (recentDays - 1);
          
          const maxRealisticProfit = avgDailyChange * options.maxTradeDurationDays * 1.2;
          exitPrice = currentPrice * (1 + Math.min(0.12, maxRealisticProfit));
        }
      }
      
      return {
        strategy: this.name,
        action: "BUY",
        confidence: 0.6,
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: currentPrice * 0.96,
      };
    }

    // Price below both MAs - bearish
    if (currentPrice < shortMA && currentPrice < longMA && shortMA < longMA) {
      return {
        strategy: this.name,
        action: "SELL",
        confidence: 0.6,
      };
    }

    return {
      strategy: this.name,
      action: "HOLD",
      confidence: 0.3,
    };
  }
}
