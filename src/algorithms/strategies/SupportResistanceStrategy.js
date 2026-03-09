/**
 * SupportResistanceStrategy - Identifies support and resistance levels
 */
export class SupportResistanceStrategy {
  constructor(config = null) {
    this.name = "SupportResistance";
    this.config = config || { lookbackPeriod: 30, proximityThreshold: 0.02 };
    this.lookbackPeriod = this.config.lookbackPeriod;
  }

  /**
   * Find support and resistance levels
   * @private
   */
  findSupportResistance(prices) {
    if (prices.length < 10) {
      return { support: null, resistance: null };
    }

    // Find local minima (support) and maxima (resistance)
    const minima = [];
    const maxima = [];

    for (let i = 2; i < prices.length - 2; i++) {
      if (
        prices[i] < prices[i - 1] &&
        prices[i] < prices[i - 2] &&
        prices[i] < prices[i + 1] &&
        prices[i] < prices[i + 2]
      ) {
        minima.push(prices[i]);
      }
      if (
        prices[i] > prices[i - 1] &&
        prices[i] > prices[i - 2] &&
        prices[i] > prices[i + 1] &&
        prices[i] > prices[i + 2]
      ) {
        maxima.push(prices[i]);
      }
    }

    // Find most common support (lowest significant minima)
    const support =
      minima.length > 0
        ? minima.sort((a, b) => a - b).slice(0, Math.ceil(minima.length * 0.3))
        : [Math.min(...prices)];

    // Find most common resistance (highest significant maxima)
    const resistance =
      maxima.length > 0
        ? maxima.sort((a, b) => b - a).slice(0, Math.ceil(maxima.length * 0.3))
        : [Math.max(...prices)];

    return {
      support: support.length > 0 ? support.reduce((a, b) => a + b, 0) / support.length : null,
      resistance:
        resistance.length > 0
          ? resistance.reduce((a, b) => a + b, 0) / resistance.length
          : null,
    };
  }

  /**
   * Analyze price data for support/resistance signals
   * @param {Array} historicalData - Historical price data
   * @param {number} currentPrice - Current market price
   * @param {Object} options - Strategy options (e.g., maxTradeDurationDays)
   */
  analyze(historicalData, currentPrice, options = {}) {
    if (historicalData.length < 10) {
      return {
        strategy: this.name,
        action: "HOLD",
        confidence: 0,
      };
    }

    const prices = historicalData.map((d) => d.price);
    const { support, resistance } = this.findSupportResistance(prices);

    if (!support || !resistance) {
      return {
        strategy: this.name,
        action: "HOLD",
        confidence: 0.3,
      };
    }

    const proximityThreshold = this.config.proximityThreshold;
    const supportDistance = Math.abs(currentPrice - support) / support;
    const resistanceDistance = Math.abs(currentPrice - resistance) / resistance;

    // Price near support - BUY signal
    if (supportDistance < proximityThreshold && currentPrice >= support) {
      const strength = 1 - supportDistance / proximityThreshold;
      let exitPrice = resistance * 0.98; // Target near resistance
      
      // Adjust for quick flips - ensure exit is achievable within maxTradeDurationDays
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
          const maxExit = currentPrice * (1 + maxRealisticProfit);
          exitPrice = Math.min(exitPrice, maxExit);
        }
      }
      
      return {
        strategy: this.name,
        action: "BUY",
        confidence: Math.min(0.85, 0.5 + strength * 0.35),
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: support * 0.95, // Stop below support
      };
    }

    // Price near resistance - SELL signal
    if (resistanceDistance < proximityThreshold && currentPrice <= resistance) {
      const strength = 1 - resistanceDistance / proximityThreshold;
      return {
        strategy: this.name,
        action: "SELL",
        confidence: Math.min(0.85, 0.5 + strength * 0.35),
      };
    }

    // Price between support and resistance
    const range = resistance - support;
    const position = (currentPrice - support) / range;

    // Closer to support - slight buy bias
    if (position < 0.3) {
      let exitPrice = resistance * 0.95;
      
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
          const maxExit = currentPrice * (1 + maxRealisticProfit);
          exitPrice = Math.min(exitPrice, maxExit);
        }
      }
      
      return {
        strategy: this.name,
        action: "BUY",
        confidence: 0.5,
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: support * 0.98,
      };
    }

    // Closer to resistance - slight sell bias
    if (position > 0.7) {
      return {
        strategy: this.name,
        action: "SELL",
        confidence: 0.5,
      };
    }

    return {
      strategy: this.name,
      action: "HOLD",
      confidence: 0.3,
    };
  }
}
