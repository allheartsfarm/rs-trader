/**
 * MeanReversionStrategy - Identifies when prices deviate from mean and expects reversion
 */
export class MeanReversionStrategy {
  constructor(config = null) {
    this.name = 'MeanReversion';
    this.config = config || { lookbackPeriod: 20, deviationThreshold: 0.1, profitCap: 0.15 };
    this.lookbackPeriod = this.config.lookbackPeriod;
    this.deviationThreshold = this.config.deviationThreshold;
  }

  /**
   * Analyze price data for mean reversion signals
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
    const mean = this.calculateMean(recent);
    const stdDev = this.calculateStdDev(recent, mean);
    
    const zScore = (currentPrice - mean) / stdDev;
    const deviation = (currentPrice - mean) / mean;

    // Price significantly below mean - buy signal
    if (zScore < -1.5 || deviation < -this.config.deviationThreshold) {
      // Adjust confidence based on volume feasibility if provided
      let baseConfidence = Math.min(0.85, 0.5 + Math.abs(zScore) * 0.15);
      if (options.volumeFeasibility !== undefined && options.volumeFeasibility < 1.0) {
        // Reduce confidence when volume is constrained
        const volumePenalty = (1.0 - options.volumeFeasibility) * 0.3; // Max 30% penalty
        baseConfidence = baseConfidence * (1.0 - volumePenalty);
      }
      
      // Target mean, but cap at configured profit max
      let meanTarget = mean * 1.05;
      let maxProfitTarget = currentPrice * (1 + this.config.profitCap);
      
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
          
          // Cap profit target based on realistic daily moves
          const maxRealisticProfit = avgDailyChange * options.maxTradeDurationDays * 1.2;
          maxProfitTarget = Math.min(maxProfitTarget, currentPrice * (1 + maxRealisticProfit));
        }
      }
      
      const exitPrice = Math.min(meanTarget, maxProfitTarget);
      
      return {
        strategy: this.name,
        action: 'BUY',
        confidence: baseConfidence,
        entryPrice: currentPrice,
        exitPrice: exitPrice,
        stopLoss: currentPrice * 0.92
      };
    }

    // Price significantly above mean - sell signal
    if (zScore > 1.5 || deviation > this.deviationThreshold) {
      return {
        strategy: this.name,
        action: 'SELL',
        confidence: Math.min(0.85, 0.5 + Math.abs(zScore) * 0.15)
      };
    }

    return {
      strategy: this.name,
      action: 'HOLD',
      confidence: 0.3
    };
  }

  /**
   * Calculate mean price
   * @private
   */
  calculateMean(data) {
    const sum = data.reduce((acc, d) => acc + d.price, 0);
    return sum / data.length;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  calculateStdDev(data, mean) {
    const variance = data.reduce((acc, d) => {
      const diff = d.price - mean;
      return acc + (diff * diff);
    }, 0) / data.length;
    
    return Math.sqrt(variance) || 1; // Avoid division by zero
  }
}
