/**
 * VolumeStrategy - Analyzes trading volume to identify significant moves
 */
export class VolumeStrategy {
  constructor(config = null) {
    this.name = 'Volume';
    this.config = config || { lookbackPeriod: 10, profitCap: 0.10 };
    this.lookbackPeriod = this.config.lookbackPeriod;
  }

  /**
   * Analyze volume and price data for signals
   * @param {Array} historicalData - Historical price data with volume
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
    const avgVolume = this.averageVolume(recent);
    const recentVolume = recent[recent.length - 1].volume || 0;
    const priceChange = (currentPrice - recent[0].price) / recent[0].price;

    const volumeRatio = recentVolume / (avgVolume || 1);

    // High volume with price increase - strong buy signal
    if (volumeRatio > 1.5 && priceChange > 0.03) {
      // Cap volume-based exit at configured profit cap
      let profitTarget = Math.min(this.config.profitCap, Math.abs(priceChange) * 2);
      
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
          profitTarget = Math.min(profitTarget, maxRealisticProfit);
        }
      }
      
      return {
        strategy: this.name,
        action: 'BUY',
        confidence: Math.min(0.9, 0.6 + (volumeRatio - 1) * 0.2),
        entryPrice: currentPrice,
        exitPrice: currentPrice * (1 + profitTarget),
        stopLoss: currentPrice * 0.96
      };
    }

    // High volume with price decrease - sell signal
    if (volumeRatio > 1.5 && priceChange < -0.03) {
      return {
        strategy: this.name,
        action: 'SELL',
        confidence: Math.min(0.9, 0.6 + (volumeRatio - 1) * 0.2)
      };
    }

    // Low volume - wait for confirmation
    return {
      strategy: this.name,
      action: 'HOLD',
      confidence: 0.3
    };
  }

  /**
   * Calculate average volume
   * @private
   */
  averageVolume(data) {
    const volumes = data.map(d => d.volume || 0).filter(v => v > 0);
    if (volumes.length === 0) return 0;
    
    const sum = volumes.reduce((acc, v) => acc + v, 0);
    return sum / volumes.length;
  }
}
