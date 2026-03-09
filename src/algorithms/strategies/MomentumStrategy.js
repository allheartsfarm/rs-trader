/**
 * MomentumStrategy - Identifies trends and momentum in price movements
 */
export class MomentumStrategy {
  constructor(config = null) {
    this.name = 'Momentum';
    this.config = config || { lookbackPeriod: 5, profitCap: 0.12 };
    this.lookbackPeriod = this.config.lookbackPeriod;
  }

  /**
   * Analyze price data for momentum signals
   * @param {Array} historicalData - Historical price data
   * @param {number} currentPrice - Current market price
   * @param {Object} options - Strategy options (e.g., maxTradeDurationDays)
   * @returns {Object} Signal object
   */
  analyze(historicalData, currentPrice, options = {}) {
    if (historicalData.length < this.lookbackPeriod) {
      return {
        strategy: this.name,
        action: 'HOLD',
        confidence: 0
      };
    }

    const recent = historicalData.slice(-this.lookbackPeriod);
    const older = historicalData.slice(-this.lookbackPeriod * 2, -this.lookbackPeriod);
    
    const recentAvg = this.averagePrice(recent);
    const olderAvg = this.averagePrice(older);
    
    const momentum = (recentAvg - olderAvg) / olderAvg;
    const priceChange = (currentPrice - recent[0].price) / recent[0].price;

    // Strong upward momentum
    if (momentum > 0.05 && priceChange > 0.02) {
      // Adjust confidence based on volume feasibility if provided
      let baseConfidence = Math.min(0.9, 0.5 + Math.abs(momentum) * 5);
      if (options.volumeFeasibility !== undefined && options.volumeFeasibility < 1.0) {
        // Reduce confidence when volume is constrained
        const volumePenalty = (1.0 - options.volumeFeasibility) * 0.3; // Max 30% penalty
        baseConfidence = baseConfidence * (1.0 - volumePenalty);
      }
      // Cap momentum-based exit at configured profit cap
      let profitTarget = Math.min(this.config.profitCap, Math.abs(momentum) * 1.5);
      
      // Adjust for quick flips - ensure exit is achievable within maxTradeDurationDays
      if (options.maxTradeDurationDays) {
        // Calculate recent daily volatility
        const recentDays = Math.min(options.maxTradeDurationDays, historicalData.length - 1);
        if (recentDays > 0) {
          const recent = historicalData.slice(-recentDays);
          const avgDailyChange = recent.reduce((sum, d, i) => {
            if (i > 0) {
              return sum + Math.abs(d.price - recent[i - 1].price) / recent[i - 1].price;
            }
            return sum;
          }, 0) / (recentDays - 1);
          
          // Cap profit target based on realistic daily moves
          const maxRealisticProfit = avgDailyChange * options.maxTradeDurationDays * 1.2;
          profitTarget = Math.min(profitTarget, maxRealisticProfit);
        }
      }
      
      return {
        strategy: this.name,
        action: 'BUY',
        confidence: baseConfidence,
        entryPrice: currentPrice,
        exitPrice: currentPrice * (1 + profitTarget),
        stopLoss: currentPrice * 0.95
      };
    }

    // Strong downward momentum
    if (momentum < -0.05 && priceChange < -0.02) {
      return {
        strategy: this.name,
        action: 'SELL',
        confidence: Math.min(0.9, 0.5 + Math.abs(momentum) * 5)
      };
    }

    return {
      strategy: this.name,
      action: 'HOLD',
      confidence: 0.3
    };
  }

  /**
   * Calculate average price
   * @private
   */
  averagePrice(data) {
    const sum = data.reduce((acc, d) => acc + d.price, 0);
    return sum / data.length;
  }
}
