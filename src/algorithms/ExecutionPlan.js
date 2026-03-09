/**
 * ExecutionPlan - Calculates realistic buy/sell timing based on volume constraints
 * Implements industry best practices for algorithmic commodity trading:
 * - Market impact modeling
 * - Execution risk assessment
 * - Order splitting strategies
 * - Time-weighted execution
 */

export class ExecutionPlan {
  /**
   * Calculate execution plan for a trade
   * @param {Object} params
   * @param {number} params.quantity - Quantity to trade
   * @param {number} params.avgDailyVolume - Average daily volume
   * @param {number} params.maxTradeDurationDays - Maximum trade duration
   * @param {number} params.entryPrice - Entry price
   * @param {number} params.exitPrice - Exit price
   * @returns {Object} Execution plan with buy/sell timing
   */
  static calculateExecutionPlan({
    quantity,
    avgDailyVolume,
    maxTradeDurationDays,
    entryPrice,
    exitPrice,
  }) {
    if (!quantity || !avgDailyVolume || avgDailyVolume === 0) {
      return {
        buyDays: 0,
        holdDays: 0,
        sellDays: 0,
        totalDays: 0,
        buyVolumePercent: 0,
        sellVolumePercent: 0,
        executionRisk: "high",
        plan: "Insufficient data for execution plan",
      };
    }

    // Industry best practice: Use 20-30% of daily volume per day to minimize market impact
    // For RuneScape GE, we can be more aggressive (up to 50% for large orders)
    // but still need to account for execution time
    const maxDailyVolumeUsage = 0.5; // Use up to 50% of daily volume per day
    const conservativeDailyVolumeUsage = 0.3; // Conservative: 30% per day

    // Calculate how many days needed to buy
    const buyVolumeNeeded = quantity;
    const buyVolumePerDay = avgDailyVolume * maxDailyVolumeUsage;
    const buyDays = Math.ceil(buyVolumeNeeded / buyVolumePerDay);

    // Calculate how many days needed to sell
    const sellVolumeNeeded = quantity;
    const sellVolumePerDay = avgDailyVolume * maxDailyVolumeUsage;
    const sellDays = Math.ceil(sellVolumeNeeded / sellVolumePerDay);

    // Calculate hold period (time between completing buy and starting sell)
    // For mean reversion: hold until price reaches target
    // For momentum: hold while trend continues
    // Default: hold for at least 1 day, but can be 0 if quick flip
    const minHoldDays = 1;
    const totalExecutionDays = buyDays + sellDays;
    const availableHoldDays = Math.max(0, maxTradeDurationDays - totalExecutionDays);
    const holdDays = Math.max(minHoldDays, availableHoldDays);

    // Calculate total days
    const totalDays = buyDays + holdDays + sellDays;

    // Calculate volume percentages
    const buyVolumePercent = (buyVolumeNeeded / (avgDailyVolume * buyDays)) * 100;
    const sellVolumePercent = (sellVolumeNeeded / (avgDailyVolume * sellDays)) * 100;

    // Assess execution risk based on:
    // 1. Daily volume usage (buy/sell percentages)
    // 2. Overall volume usage over the trade duration
    const totalVolumeNeeded = quantity * 2; // Buy + sell
    const totalVolumeAvailable = avgDailyVolume * maxTradeDurationDays;
    const overallVolumeUsage = totalVolumeAvailable > 0 
      ? totalVolumeNeeded / totalVolumeAvailable 
      : 1.0;

    let executionRisk = "low";
    
    // High risk if:
    // - Using > 50% of daily volume per day, OR
    // - Using > 80% of total available volume over duration
    if (buyVolumePercent > 50 || sellVolumePercent > 50 || overallVolumeUsage > 0.8) {
      executionRisk = "high";
    } else if (buyVolumePercent > 30 || sellVolumePercent > 30 || overallVolumeUsage > 0.7) {
      executionRisk = "medium";
    }

    // Calculate slippage estimate (price impact from large orders)
    // Industry standard: 0.1-0.5% slippage per 10% of daily volume
    const buySlippagePercent = Math.min(0.5, (buyVolumePercent / 10) * 0.1);
    const sellSlippagePercent = Math.min(0.5, (sellVolumePercent / 10) * 0.1);

    // Generate execution plan description
    let plan = "";
    if (buyDays === 1 && sellDays === 1 && holdDays <= 1) {
      plan = `Buy today, ${holdDays > 0 ? `hold ${holdDays} day${holdDays > 1 ? "s" : ""}, ` : ""}sell ${sellDays === 1 ? "tomorrow" : `in ${sellDays} days`}`;
    } else {
      plan = `Buy over ${buyDays} day${buyDays > 1 ? "s" : ""} (${buyVolumePercent.toFixed(1)}% of daily volume/day), `;
      if (holdDays > 0) {
        plan += `hold ${holdDays} day${holdDays > 1 ? "s" : ""}, `;
      }
      plan += `sell over ${sellDays} day${sellDays > 1 ? "s" : ""} (${sellVolumePercent.toFixed(1)}% of daily volume/day)`;
    }

    // Add execution risk warning
    if (executionRisk === "high") {
      plan += ` ⚠️ High execution risk`;
    } else if (executionRisk === "medium") {
      plan += ` ⚠️ Moderate execution risk`;
    }

    return {
      buyDays,
      holdDays,
      sellDays,
      totalDays,
      buyVolumePercent,
      sellVolumePercent,
      executionRisk,
      buySlippagePercent,
      sellSlippagePercent,
      plan,
      // Detailed breakdown for display
      breakdown: {
        buy: {
          days: buyDays,
          volumePerDay: buyVolumePerDay,
          volumePercent: buyVolumePercent,
          slippage: buySlippagePercent,
        },
        hold: {
          days: holdDays,
        },
        sell: {
          days: sellDays,
          volumePerDay: sellVolumePerDay,
          volumePercent: sellVolumePercent,
          slippage: sellSlippagePercent,
        },
      },
    };
  }

  /**
   * Adjust confidence based on execution risk
   * Higher execution risk = lower confidence
   */
  static adjustConfidenceForExecutionRisk(baseConfidence, executionRisk) {
    if (executionRisk === "high") {
      return baseConfidence * 0.85; // Reduce by 15%
    } else if (executionRisk === "medium") {
      return baseConfidence * 0.95; // Reduce by 5%
    }
    return baseConfidence;
  }
}
