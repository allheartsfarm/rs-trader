/**
 * RSIStrategy - Uses Relative Strength Index to identify overbought/oversold conditions
 */
export class RSIStrategy {
  constructor(config = null) {
    this.name = "RSI";
    this.config = config || { period: 14, overbought: 70, oversold: 30 };
    this.period = this.config.period;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   * @private
   */
  calculateRSI(prices) {
    if (prices.length < this.period + 1) {
      return 50; // Neutral RSI if not enough data
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.filter((c) => c > 0);
    const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));

    const avgGain =
      gains.length > 0 ? gains.reduce((sum, g) => sum + g, 0) / gains.length : 0;
    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, l) => sum + l, 0) / losses.length
        : 0.01; // Avoid division by zero

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Analyze price data for RSI signals
   * @param {Array} historicalData - Historical price data
   * @param {number} currentPrice - Current market price
   * @param {Object} options - Strategy options (e.g., maxTradeDurationDays)
   */
  analyze(historicalData, currentPrice, options = {}) {
    if (historicalData.length < this.period + 1) {
      return {
        strategy: this.name,
        action: "HOLD",
        confidence: 0,
      };
    }

    const prices = historicalData.map((d) => d.price);
    prices.push(currentPrice); // Include current price

    const rsi = this.calculateRSI(prices);

    // Oversold condition - BUY signal
    if (rsi < this.config.oversold) {
      const oversoldStrength = (this.config.oversold - rsi) / this.config.oversold;
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
        confidence: Math.min(0.9, 0.5 + oversoldStrength * 0.4),
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: currentPrice * 0.95,
      };
    }

    // Overbought condition - SELL signal
    if (rsi > this.config.overbought) {
      const overboughtStrength = (rsi - this.config.overbought) / (100 - this.config.overbought);
      return {
        strategy: this.name,
        action: "SELL",
        confidence: Math.min(0.9, 0.5 + overboughtStrength * 0.4),
      };
    }

    // Neutral RSI
    return {
      strategy: this.name,
      action: "HOLD",
      confidence: 0.3,
    };
  }
}
