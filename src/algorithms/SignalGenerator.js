import { MomentumStrategy } from "./strategies/MomentumStrategy.js";
import { MeanReversionStrategy } from "./strategies/MeanReversionStrategy.js";
import { VolumeStrategy } from "./strategies/VolumeStrategy.js";
import { RSIStrategy } from "./strategies/RSIStrategy.js";
import { MovingAverageStrategy } from "./strategies/MovingAverageStrategy.js";
import { SupportResistanceStrategy } from "./strategies/SupportResistanceStrategy.js";
import { Settings } from "../config/Settings.js";
import { ExecutionPlan } from "./ExecutionPlan.js";
import {
  calculateGEFee,
  calculateNetProfit,
  calculateTotalCost,
} from "../utils/GEFee.js";

/**
 * SignalGenerator - Generates trading signals using multiple algorithms
 */
export class SignalGenerator {
  constructor(settings = null) {
    this.settings = settings || new Settings();
    // Get config once for strategies initialization
    const config = this.settings.getConfig();
    this.strategies = [
      new MomentumStrategy(config.strategies.momentum),
      new MeanReversionStrategy(config.strategies.meanReversion),
      new VolumeStrategy(config.strategies.volume),
      new RSIStrategy(config.strategies.rsi),
      new MovingAverageStrategy(config.strategies.movingAverage),
      new SupportResistanceStrategy(config.strategies.supportResistance),
    ];
  }

  /**
   * Get current config (always fresh from settings)
   * This ensures we see updates to config made by TradingBot
   */
  get config() {
    return this.settings.getConfig();
  }

  /**
   * Generate a trading signal for an item
   * @param {string} itemName - Name of the item
   * @param {Array} historicalData - Historical price data
   * @param {number} currentPrice - Current market price
   * @returns {Object} Signal object with action, confidence, entryPrice, exitPrice, quantity
   */
  generateSignal(itemName, historicalData, currentPrice) {
    if (!historicalData || historicalData.length < 5) {
      return {
        item: itemName,
        action: "HOLD",
        confidence: 0,
        reason: "Insufficient data",
      };
    }

    const maxTradeDurationDays = this.config.trading.maxTradeDurationDays;

    // Calculate volume feasibility metrics early to inform strategies
    let volumeFeasibility = 1.0; // 1.0 = fully feasible, < 1.0 = constrained
    let avgDailyVolume = 0;
    if (historicalData.length > 0 && maxTradeDurationDays) {
      const recentDays = Math.min(
        maxTradeDurationDays + 2,
        historicalData.length
      );
      const recentData = historicalData.slice(-recentDays);
      const volumes = recentData.map((d) => d.volume || 0).filter((v) => v > 0);

      if (volumes.length > 0) {
        avgDailyVolume =
          volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

        // Estimate required volume based on typical trade size for this capital
        const { baseCapital, positionSizePercent, minProfitPerTrade } =
          this.config.trading;
        const estimatedPositionSize = baseCapital * positionSizePercent;
        const estimatedQuantity = Math.floor(
          estimatedPositionSize / currentPrice
        );
        const requiredVolume = estimatedQuantity * 2; // Buy + sell

        // Calculate volume usage percentage based on duration
        const volumeUsagePercent =
          maxTradeDurationDays >= 5
            ? 0.95
            : maxTradeDurationDays >= 3
            ? 0.9
            : 0.75;
        const availableVolume =
          avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;

        // Volume feasibility: how much of required volume is available
        // If available >= required, feasibility = 1.0
        // If available < required, feasibility = available / required (0.0 to 1.0)
        volumeFeasibility =
          availableVolume > 0
            ? Math.min(1.0, availableVolume / requiredVolume)
            : 0.0;
      }
    }

    const strategyOptions = {
      maxTradeDurationDays,
      volumeFeasibility, // Pass volume feasibility to strategies
      avgDailyVolume, // Pass average daily volume for context
    };

    const signals = this.strategies.map((strategy) =>
      strategy.analyze(historicalData, currentPrice, strategyOptions)
    );

    // Aggregate signals from all strategies
    const aggregated = this.aggregateSignals(signals);

    // Calculate realistic exit price based on historical data
    const realisticExitPrice = this.calculateRealisticExitPrice(
      historicalData,
      currentPrice,
      aggregated.exitPrice
    );

    const entryPrice = aggregated.entryPrice || currentPrice;
    let exitPrice = realisticExitPrice;

    // Validate exit price is realistic before adjusting for profit targets
    const prices = historicalData.map((d) => d.price);
    const historicalMax = Math.max(...prices);
    const historicalMin = Math.min(...prices);
    const historicalAvg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // For 2-day trades, cap profit margin at realistic levels (max 20% if historical supports it)
    // But prefer 10-15% for more realistic trades
    const maxRealisticProfitPercent =
      maxTradeDurationDays === 2
        ? Math.min(0.2, this.config.trading.profitTargetPercent.max)
        : this.config.trading.profitTargetPercent.max;
    const maxRealisticExit = entryPrice * (1 + maxRealisticProfitPercent);

    // Don't exceed historical max by more than 10%
    const historicalMaxCap = historicalMax * 1.1;

    // Additional check: if exit price would be more than 20% above current,
    // verify it's not more than 5% above historical max (very strict)
    if (exitPrice > entryPrice * 1.2) {
      const strictHistoricalCap = historicalMax * 1.05; // Only 5% above historical max for high-profit trades
      exitPrice = Math.min(exitPrice, strictHistoricalCap);
    }

    // Apply all realistic caps
    exitPrice = Math.min(exitPrice, maxRealisticExit, historicalMaxCap);

    // Final sanity check: exit must be higher than entry
    if (exitPrice <= entryPrice) {
      exitPrice = entryPrice * 1.05; // Minimum 5% profit
    }

    // For items with small profit margins, try to meet profit targets
    // But only if it's still realistic
    const { minProfitPerTrade } = this.config.trading;
    const testQuantity = Math.floor(
      (this.config.trading.baseCapital *
        this.config.trading.positionSizePercent) /
        entryPrice
    );

    if (testQuantity > 0) {
      // Test if current exit price would meet minimum profit
      let testNetProfit = calculateNetProfit(
        entryPrice,
        exitPrice,
        testQuantity
      );

      // If not meeting minimum AND we have room to increase (within realistic bounds)
      if (
        testNetProfit < minProfitPerTrade &&
        exitPrice < maxRealisticExit &&
        exitPrice < historicalMaxCap
      ) {
        // Calculate needed exit price, but respect all caps
        if (entryPrice > 50) {
          const neededNetProfitPerUnit = minProfitPerTrade / testQuantity;
          const neededExitPrice =
            (neededNetProfitPerUnit + entryPrice * 1.02) / 0.98;
          exitPrice = Math.min(
            neededExitPrice,
            maxRealisticExit,
            historicalMaxCap
          );
        } else {
          const neededProfitPerUnit = minProfitPerTrade / testQuantity;
          exitPrice = Math.min(
            entryPrice + neededProfitPerUnit,
            maxRealisticExit,
            historicalMaxCap
          );
        }
      }
    }

    // Adjust exit price to account for GE fees to ensure net profit targets
    let adjustedExitPrice = this.adjustExitPriceForFees(entryPrice, exitPrice);

    // Re-apply historical cap after fee adjustment to ensure we don't exceed it
    adjustedExitPrice = Math.min(adjustedExitPrice, historicalMaxCap);

    // Calculate desired quantity based on profit/capital (before volume constraints)
    const desiredQuantity = this.calculateQuantity(
      entryPrice,
      adjustedExitPrice,
      aggregated.confidence,
      historicalData,
      false // Don't apply volume constraints yet
    );

    // Check volume feasibility using DESIRED quantity (before limiting)
    // This tells us if the trade is fundamentally feasible
    let desiredVolumeFeasibility = 1.0;
    if (
      historicalData.length > 0 &&
      maxTradeDurationDays &&
      desiredQuantity > 0 &&
      avgDailyVolume > 0
    ) {
      const desiredRequiredVolume = desiredQuantity * 2; // Buy + sell
      const volumeUsagePercent =
        maxTradeDurationDays >= 5
          ? 0.95
          : maxTradeDurationDays >= 3
          ? 0.9
          : 0.75;
      const availableVolume =
        avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;

      // Desired volume feasibility: can we execute the desired trade?
      desiredVolumeFeasibility =
        availableVolume > 0
          ? Math.min(1.0, availableVolume / desiredRequiredVolume)
          : 0.0;
    }

    // For a flipping bot, we always try to generate BUY signals
    // Volume constraints will be applied in calculateQuantity to reduce quantity
    // Only convert to HOLD if quantity ends up being 0 or there's no profit

    // Now calculate actual quantity with volume constraints applied
    let quantity = this.calculateQuantity(
      entryPrice,
      adjustedExitPrice,
      aggregated.confidence,
      historicalData,
      true // Apply volume constraints
    );

    // Check if trade exceeds capital limits BEFORE checking quantity
    const { baseCapital, positionSizePercent } = this.config.trading;
    const maxPositionSize = baseCapital * positionSizePercent;
    const singleUnitCost = entryPrice * 1.02; // Entry price + 2% fee

    // If even a single unit exceeds capital, this trade is not feasible
    if (aggregated.action === "BUY" && singleUnitCost > maxPositionSize) {
      return {
        item: itemName,
        action: "HOLD",
        confidence: 0,
        reason: `Single unit cost (${Math.floor(
          singleUnitCost
        ).toLocaleString()} gp) exceeds available capital (${Math.floor(
          maxPositionSize
        ).toLocaleString()} gp)`,
      };
    }

    // For a flipping bot, only convert to HOLD if quantity is 0 or trade is unprofitable
    // Volume constraints have already been applied, so if quantity > 0, we have a viable trade
    if (aggregated.action === "BUY" && quantity <= 0) {
      return {
        item: itemName,
        action: "HOLD",
        confidence: 0.1,
        reason: "Quantity too low after volume constraints - no viable trade",
      };
    }

    // Recalculate volume feasibility using ACTUAL quantity (after volume constraints)
    // This is for display and confidence adjustment
    let actualVolumeFeasibility = 1.0;
    if (
      historicalData.length > 0 &&
      maxTradeDurationDays &&
      quantity > 0 &&
      avgDailyVolume > 0
    ) {
      const actualRequiredVolume = quantity * 2; // Buy + sell
      // Use the same volume usage percentages as calculateQuantity for consistency
      const volumeUsagePercent =
        maxTradeDurationDays >= 5
          ? 0.7 // 70% for 5+ day trades (matches calculateQuantity)
          : maxTradeDurationDays >= 3
          ? 0.6 // 60% for 3-4 day trades
          : 0.5; // 50% for 1-2 day trades
      const actualAvailableVolume =
        avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;

      // If quantity would use > 70% of safe volume, reduce it to use max 70%
      // This ensures we stay well below 100% usage
      // Profit margin percentage doesn't change with quantity, so we just need to ensure
      // the trade is still profitable (netProfit > 0)
      const volumeUsageRatio =
        actualAvailableVolume > 0
          ? actualRequiredVolume / actualAvailableVolume
          : 1.0;

      if (volumeUsageRatio > 0.7) {
        // Reduce quantity to use max 70% of safe volume
        const maxSafeRequiredVolume = actualAvailableVolume * 0.7;
        const maxSafeQuantity = Math.floor(maxSafeRequiredVolume / 2); // Half for buy, half for sell
        if (quantity > maxSafeQuantity && maxSafeQuantity > 0) {
          // Verify reduced quantity is still profitable
          const reducedNetProfit = calculateNetProfit(
            entryPrice,
            adjustedExitPrice,
            maxSafeQuantity
          );
          if (reducedNetProfit > 0) {
            quantity = maxSafeQuantity;
          }
        }
      }

      // Recalculate with final quantity
      const finalRequiredVolume = quantity * 2;
      actualVolumeFeasibility =
        actualAvailableVolume > 0
          ? Math.min(1.0, actualAvailableVolume / finalRequiredVolume)
          : 0.0;
    }

    // Calculate execution plan for buy/sell timing (using final quantity after volume reduction)
    let executionPlan = null;
    if (aggregated.action === "BUY" && quantity > 0 && avgDailyVolume > 0) {
      executionPlan = ExecutionPlan.calculateExecutionPlan({
        quantity,
        avgDailyVolume,
        maxTradeDurationDays,
        entryPrice: entryPrice,
        exitPrice: Math.round(adjustedExitPrice * 100) / 100,
      });

      // Adjust exit price to account for execution timeline
      // Exit price should be realistic for when we'll actually be selling
      // (after buy days + hold days, during the sell period)
      if (executionPlan && executionPlan.totalDays > 0) {
        // Calculate when we'll be selling (average day during sell period)
        const sellStartDay = executionPlan.buyDays + executionPlan.holdDays;
        const sellEndDay = executionPlan.totalDays;
        const avgSellDay = (sellStartDay + sellEndDay) / 2; // Average day we'll be selling

        // Get historical price caps (already calculated earlier)
        const prices = historicalData.map((d) => d.price);
        const historicalMax = Math.max(...prices);
        const historicalMaxCap = historicalMax * 1.1;
        const maxRealisticExit =
          entryPrice * (1 + this.config.trading.profitTargetPercent.max);

        // Estimate price movement based on historical volatility
        const recentDays = Math.min(10, historicalData.length - 1);
        if (recentDays > 0) {
          const recentData = historicalData.slice(-recentDays);
          const priceChanges = [];
          for (let i = 1; i < recentData.length; i++) {
            const change =
              (recentData[i].price - recentData[i - 1].price) /
              recentData[i - 1].price;
            priceChanges.push(change);
          }

          if (priceChanges.length > 0) {
            const avgDailyPriceChange =
              priceChanges.reduce((sum, c) => sum + c, 0) / priceChanges.length;

            // Adjust exit price to account for price movement by the time we're selling
            // If price tends to increase, exit price should be higher
            // If price tends to decrease, exit price should be lower
            // But be conservative - don't assume extreme movements
            const conservativePriceChange = avgDailyPriceChange * 0.5; // Use 50% of average change (conservative)
            const priceAdjustment =
              currentPrice * conservativePriceChange * avgSellDay;
            const timelineAdjustedExitPrice =
              adjustedExitPrice + priceAdjustment;

            // Use the timeline-adjusted price, but respect all existing caps
            // Historical max cap is the most important - we can't exceed what's historically possible
            // When selling over multiple days, be more conservative (don't assume peak price)
            const maxIncrease =
              executionPlan.sellDays > 1
                ? adjustedExitPrice * 1.1 // Only 10% increase when selling over multiple days
                : adjustedExitPrice * 1.15; // 15% increase for single-day sells

            // For multi-day sells, use stricter historical cap (5% above max instead of 10%)
            const strictHistoricalCap =
              executionPlan.sellDays > 1
                ? historicalMax * 1.05 // Only 5% above max for multi-day sells
                : historicalMaxCap; // 10% above max for single-day sells

            adjustedExitPrice = Math.min(
              timelineAdjustedExitPrice,
              strictHistoricalCap, // Most restrictive: can't exceed historical max
              maxRealisticExit, // Also respect profit target max
              maxIncrease // Don't increase by more than allowed
            );

            // Ensure exit price is still higher than entry
            if (adjustedExitPrice <= entryPrice) {
              adjustedExitPrice = entryPrice * 1.05; // Minimum 5% profit
            }
          }
        }
      }
    }

    // Adjust aggregated confidence based on ACTUAL volume feasibility
    // Low volume = harder to execute = lower confidence
    // High volume usage (> 80%) = risky execution = lower confidence
    let finalConfidence = aggregated.confidence;
    if (aggregated.action === "BUY") {
      if (actualVolumeFeasibility < 1.0) {
        // Reduce confidence proportionally to volume constraint
        if (actualVolumeFeasibility < 0.3) {
          // When feasibility is very low, cap confidence so it reflects execution risk
          finalConfidence = Math.min(aggregated.confidence, Math.max(0.05, actualVolumeFeasibility));
        } else {
          // If actualVolumeFeasibility is 0.5 (50% of needed volume available), reduce confidence by 25%
          const volumePenalty = (1.0 - actualVolumeFeasibility) * 0.5; // Max 50% penalty
          finalConfidence = Math.max(
            0.1,
            aggregated.confidence * (1.0 - volumePenalty)
          );
        }
      } else if (actualVolumeFeasibility >= 0.8) {
        // Using > 80% of available volume is risky:
        // - No buffer for volume variations
        // - High market impact risk
        // - Execution slippage likely
        // - Other traders competing for same volume
        // Penalize confidence based on how close to 100%
        const highUsagePenalty = (actualVolumeFeasibility - 0.8) * 0.5; // 0-10% penalty for 80-100% usage
        finalConfidence = Math.max(
          0.1,
          aggregated.confidence * (1.0 - highUsagePenalty)
        );
      }
    }

    // Further adjust confidence based on execution risk
    if (executionPlan && executionPlan.executionRisk !== "low") {
      finalConfidence = ExecutionPlan.adjustConfidenceForExecutionRisk(
        finalConfidence,
        executionPlan.executionRisk
      );
    }

    // Calculate costs and profits with GE fees
    const totalCost = calculateTotalCost(entryPrice, quantity);
    const netProfit = calculateNetProfit(
      entryPrice,
      adjustedExitPrice,
      quantity
    );

    // Check if trade exceeds capital limits (using already declared variables from above)
    const totalCostWithFees = calculateTotalCost(entryPrice, quantity);

    // For a flipping bot, only convert to HOLD if there's no profit after fees or exceeds capital
    if (aggregated.action === "BUY") {
      // Check if trade exceeds available capital (maxPositionSize already calculated above)
      if (totalCostWithFees > maxPositionSize) {
        return {
          item: itemName,
          action: "HOLD",
          confidence: 0,
          reason: `Trade cost (${Math.floor(
            totalCostWithFees
          ).toLocaleString()} gp) exceeds available capital (${Math.floor(
            maxPositionSize
          ).toLocaleString()} gp)`,
        };
      }

      if (netProfit <= 0) {
        return {
          item: itemName,
          action: "HOLD",
          confidence: 0,
          reason: "No profit after fees - trade not viable",
        };
      }
    }

    // Filter out signals where entry and exit prices round to the same value
    // This makes the trade pointless (e.g., 2 -> 2)
    const entryRounded = Math.floor(entryPrice);
    const exitRounded = Math.floor(adjustedExitPrice);
    if (entryRounded === exitRounded && aggregated.action === "BUY") {
      return {
        item: itemName,
        action: "HOLD",
        confidence: 0,
        reason:
          "Entry and exit prices round to the same value - no profit opportunity",
      };
    }

    // Determine final action (may have been converted to HOLD)
    const finalAction = aggregated.action; // This is the final action after all checks

    // Generate explanation and benefits for the recommendation
    // Pass finalAction to ensure explanation matches the final action
    const { explanation, benefits } = this.generateExplanation(
      signals,
      { ...aggregated, action: finalAction }, // Use final action for explanation
      historicalData,
      currentPrice,
      quantity,
      netProfit,
      finalConfidence // Use final confidence (adjusted for volume)
    );

    return {
      item: itemName,
      action: finalAction,
      confidence: finalConfidence, // Use confidence adjusted for actual volume feasibility
      entryPrice: entryPrice,
      exitPrice: Math.round(adjustedExitPrice * 100) / 100,
      quantity: quantity,
      stopLoss: aggregated.stopLoss || currentPrice * 0.95,
      strategies: signals.map((s) => s.strategy), // Strategy names for backward compatibility
      strategySignals: signals, // Full signal data with confidence and action
      totalCost: totalCost,
      netProfit: netProfit,
      explanation: explanation,
      benefits: benefits,
      volumeFeasibility: actualVolumeFeasibility, // Store actual volume feasibility for display
      avgDailyVolume: avgDailyVolume, // Store for display
      executionPlan: executionPlan, // Store execution plan for display
    };
  }

  /**
   * Generate signals for multiple items
   * @param {Array} items - Array of { name, data, currentPrice }
   * @returns {Array} Array of signals
   */
  generateSignalsForItems(items) {
    return items.map((item) =>
      this.generateSignal(item.name, item.data, item.currentPrice)
    );
  }

  /**
   * Aggregate signals from multiple strategies
   * Normalizes confidence scores and applies strategy weights
   * @private
   */
  aggregateSignals(signals) {
    const buySignals = signals.filter((s) => s.action === "BUY");
    const sellSignals = signals.filter((s) => s.action === "SELL");
    const holdSignals = signals.filter((s) => s.action === "HOLD");

    // Get strategy configs for normalization and weighting
    const strategyConfigs = this.settings.getConfig().strategies;

    // Map strategy names (class names) to config keys (camelCase)
    const configKeyMap = {
      Momentum: "momentum",
      MeanReversion: "meanReversion",
      Volume: "volume",
      RSI: "rsi",
      MovingAverage: "movingAverage",
      SupportResistance: "supportResistance",
    };

    /**
     * Normalize and weight a signal's confidence
     * @param {Object} signal - Signal object with strategy name and confidence
     * @returns {Object} Normalized confidence and weight
     */
    const normalizeAndWeight = (signal) => {
      const strategyName = signal.strategy || "";
      const configKey =
        configKeyMap[strategyName] || strategyName.toLowerCase();
      const config = strategyConfigs[configKey] || {};
      const maxConfidence = config.maxConfidence || 0.9; // Default max
      const weight = config.weight || 1.0; // Default weight

      // Normalize confidence to 0-1 scale based on strategy's max
      const normalizedConfidence = Math.min(
        1.0,
        signal.confidence / maxConfidence
      );

      // Return normalized confidence and weight for weighted average calculation
      return { normalized: normalizedConfidence, weight };
    };

    // If any strategy suggests buy, consider it (more lenient)
    if (buySignals.length > 0) {
      // Normalize and weight each signal
      const normalizedSignals = buySignals.map(normalizeAndWeight);

      // Calculate weighted average of normalized confidences
      const weightedSum = normalizedSignals.reduce(
        (sum, ns) => sum + ns.normalized * ns.weight,
        0
      );
      const totalWeight = normalizedSignals.reduce(
        (sum, ns) => sum + ns.weight,
        0
      );
      const weightedAvgConfidence =
        totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Convert back to 0-1 scale (since normalized is already 0-1)
      // But we want to preserve the "strength" of the signal
      // So we'll use the weighted average directly, capped at 0.95
      let finalConfidence = Math.min(0.95, weightedAvgConfidence);

      // Boost confidence if multiple strategies agree
      // Rationale: When multiple independent strategies agree, it increases the probability
      // that the signal is valid. A 10% boost (0.1) is a conservative estimate of the
      // additional confidence gained from consensus among strategies.
      const confidenceBoost = buySignals.length > 1 ? 0.1 : 0;
      finalConfidence = Math.min(0.95, finalConfidence + confidenceBoost);

      // Calculate average entry/exit prices (unweighted - prices are absolute)
      const avgEntry =
        buySignals.reduce((sum, s) => sum + (s.entryPrice || 0), 0) /
        buySignals.length;
      const avgExit =
        buySignals.reduce((sum, s) => sum + (s.exitPrice || 0), 0) /
        buySignals.length;

      return {
        action: "BUY",
        confidence: finalConfidence,
        entryPrice: avgEntry,
        exitPrice: avgExit,
      };
    }

    // If any strategy suggests sell
    if (sellSignals.length > 0) {
      // Normalize and weight each signal (reuse the helper function)
      const normalizedSignals = sellSignals.map(normalizeAndWeight);

      // Calculate weighted average
      const weightedSum = normalizedSignals.reduce(
        (sum, ns) => sum + ns.normalized * ns.weight,
        0
      );
      const totalWeight = normalizedSignals.reduce(
        (sum, ns) => sum + ns.weight,
        0
      );
      const weightedAvgConfidence =
        totalWeight > 0 ? weightedSum / totalWeight : 0;

      let finalConfidence = Math.min(0.95, weightedAvgConfidence);
      const confidenceBoost = sellSignals.length > 1 ? 0.1 : 0;
      finalConfidence = Math.min(0.95, finalConfidence + confidenceBoost);

      return {
        action: "SELL",
        confidence: finalConfidence,
      };
    }

    // If all strategies say hold, but we still want to show something
    // Find the strategy with highest confidence and use it as a weak signal
    const maxConfidenceSignal = signals.reduce(
      (max, s) => (s.confidence > max.confidence ? s : max),
      signals[0] || { confidence: 0 }
    );

    // Return a HOLD with actionable information
    return {
      action: "HOLD",
      confidence: Math.max(0.4, maxConfidenceSignal.confidence || 0.4),
      reason:
        "Market conditions suggest waiting, but monitoring for opportunities",
    };
  }

  /**
   * Adjust exit price to account for GE fees
   * Ensures net profit meets targets after fees
   * @private
   */
  adjustExitPriceForFees(entryPrice, exitPrice) {
    if (entryPrice <= 50) {
      // No fees for items <= 50 gp
      return exitPrice;
    }

    // For items > 50 gp, we have 2% fee on both buy and sell
    // Net profit per unit = exitPrice * 0.98 - entryPrice * 1.02
    // To achieve the same net profit as the original exitPrice target:
    // We need: adjustedExit * 0.98 - entryPrice * 1.02 = exitPrice - entryPrice
    // Solving: adjustedExit = (exitPrice - entryPrice + entryPrice * 1.02) / 0.98
    //         = (exitPrice - entryPrice + entryPrice * 1.02) / 0.98
    //         = (exitPrice + entryPrice * 0.02) / 0.98

    const adjustedExit = (exitPrice + entryPrice * 0.02) / 0.98;

    return Math.round(adjustedExit * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculate recommended quantity based on target profit per trade
   * Also considers volume feasibility for quick completion
   * @param {boolean} applyVolumeConstraints - If true, limit quantity based on available volume
   * @private
   */
  calculateQuantity(
    entryPrice,
    exitPrice,
    confidence,
    historicalData = [],
    applyVolumeConstraints = true
  ) {
    const {
      minProfitPerTrade,
      targetProfitPerTrade,
      baseCapital,
      positionSizePercent,
    } = this.config.trading;

    // Calculate net profit per unit (accounting for fees)
    let profitPerUnit = exitPrice - entryPrice;
    if (entryPrice > 50) {
      // Account for 2% fees on both entry and exit
      // Net profit = gross - entryFee - exitFee
      // = (exit - entry) - entry*0.02 - exit*0.02
      // = exit*0.98 - entry*1.02
      profitPerUnit = exitPrice * 0.98 - entryPrice * 1.02;
    }

    if (profitPerUnit <= 0) {
      // Not profitable after fees, use minimal quantity or skip
      // Fallback to capital-based calculation but warn
      const positionSize = baseCapital * confidence * positionSizePercent;
      const fallbackQty = Math.floor(positionSize / entryPrice);
      // Return minimal quantity if still not profitable
      return Math.max(1, Math.floor(fallbackQty * 0.1)); // 10% of normal size
    }

    // Calculate quantity needed for minimum profit (always aim for at least minimum)
    // Account for fees in profit calculation
    let quantityForMinProfit = Math.ceil(
      (minProfitPerTrade * 1.05) / profitPerUnit
    ); // 5% buffer

    // Calculate quantity for target profit (weighted by confidence)
    const targetProfit =
      minProfitPerTrade +
      (targetProfitPerTrade - minProfitPerTrade) * confidence;
    let quantityForTarget = Math.ceil((targetProfit * 1.05) / profitPerUnit); // 5% buffer

    // Consider capital constraints - use full position size percent
    // With larger capital (50M+), we can afford larger positions
    const maxQuantityByCapital = Math.floor(
      (baseCapital * positionSizePercent) / entryPrice
    );

    // With large capital (50M+), prioritize meeting minimum profit target
    const isLargeCapital = baseCapital >= 30000000;
    let quantity;

    if (isLargeCapital) {
      // Start with quantity needed for minimum profit
      quantity = quantityForMinProfit;

      // If we can afford target profit, use that instead
      if (quantityForTarget <= maxQuantityByCapital) {
        quantity = quantityForTarget;
      } else {
        // Use max capital to maximize profit
        quantity = maxQuantityByCapital;
      }
    } else {
      // For smaller capital, start with target profit quantity
      quantity = quantityForTarget;

      // If target requires more capital than available, use what we can
      if (quantityForTarget > maxQuantityByCapital) {
        quantity = maxQuantityByCapital;
      }
    }

    // Ensure we don't exceed capital
    quantity = Math.min(quantity, maxQuantityByCapital);

    // If even 1 unit exceeds capital, this trade is not feasible
    // Check if a single unit costs more than available position size
    const singleUnitCost = entryPrice * 1.02; // Entry price + 2% fee
    const maxPositionSize = baseCapital * positionSizePercent;
    if (singleUnitCost > maxPositionSize) {
      // Even 1 unit exceeds capital - return 0 to indicate trade is not feasible
      return 0;
    }

    // Verify this quantity actually meets minimum profit after fees
    const testNetProfit = calculateNetProfit(entryPrice, exitPrice, quantity);

    // With large capital (50M+), aggressively increase quantity to meet profit targets
    if (testNetProfit < minProfitPerTrade && baseCapital >= 30000000) {
      // Calculate exactly what we need for minimum profit
      const neededQuantity = Math.ceil(
        (minProfitPerTrade * 1.15) / profitPerUnit
      );
      // Use the maximum of: needed quantity, target quantity, or available capital
      quantity = Math.min(
        Math.max(neededQuantity, quantityForTarget, quantityForMinProfit),
        maxQuantityByCapital
      );

      // Final check - if still not meeting minimum with max capital, that's the best we can do
      const finalNetProfit = calculateNetProfit(
        entryPrice,
        exitPrice,
        quantity
      );
      if (finalNetProfit < minProfitPerTrade * 0.8) {
        // Still below 80% of target - this trade may not be viable for 500k target
        // But keep it if it's at least profitable
      }
    } else if (testNetProfit < minProfitPerTrade * 0.9) {
      // For smaller capital, be more conservative
      const neededQuantity = Math.ceil(
        (minProfitPerTrade * 1.1) / profitPerUnit
      );
      quantity = Math.min(neededQuantity, maxQuantityByCapital);
    }

    // Check volume feasibility for 2-day completion (only if applyVolumeConstraints is true)
    // IMPORTANT: This must be done AFTER all profit-based quantity adjustments
    // Volume constraint is a HARD limit that cannot be exceeded
    const { maxTradeDurationDays } = this.config.trading;
    if (
      applyVolumeConstraints &&
      historicalData.length > 0 &&
      maxTradeDurationDays
    ) {
      // Calculate average daily volume over recent days
      const recentDays = Math.min(
        maxTradeDurationDays + 2,
        historicalData.length
      );
      const recentData = historicalData.slice(-recentDays);
      const volumes = recentData.map((d) => d.volume || 0).filter((v) => v > 0);

      if (volumes.length > 0) {
        const avgDailyVolume =
          volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

        // For quick flips, we need to be able to buy and sell within the timeframe
        // With 50M capital, we can be much more aggressive with volume
        const isLargeCapital = baseCapital >= 30000000;
        const requiredVolume = quantity * 2; // Buy + sell

        if (isLargeCapital) {
          // With 50M capital, maximize usage but stay realistic about volume
          // Use actual daily volume as the constraint - can't trade more than what's available
          // For quick flips, use volume from the duration period
          // Allow using up to 90% of available volume (realistic but maximizes usage)
          const availableVolumeForPeriod =
            avgDailyVolume * maxTradeDurationDays;

          // Use more conservative volume percentages to avoid 100% usage
          // Target: 50-70% of available volume for better execution feasibility
          // For longer durations, we can use slightly more (more time = more volume available)
          // For 1-day trades, be very conservative (50%) to ensure we can actually complete
          const volumeUsagePercent =
            maxTradeDurationDays >= 5
              ? 0.7 // 70% for 5+ day trades
              : maxTradeDurationDays >= 3
              ? 0.6 // 60% for 3-4 day trades
              : 0.5; // 50% for 1-2 day trades (very conservative)
          const realisticVolumeLimit =
            availableVolumeForPeriod * volumeUsagePercent;
          const realisticQty = Math.floor(realisticVolumeLimit / 2); // Half for buy, half for sell

          // Apply volume constraint - reduce quantity to use less volume
          quantity = Math.min(
            quantity, // Current quantity (may have been increased for profit)
            realisticQty, // HARD LIMIT: Cannot exceed realistic volume
            maxQuantityByCapital // And not more than capital allows
          );

          // After reducing quantity for volume, verify we still meet minimum 5% profit margin
          // If not, reduce quantity further until we meet 5% OR reject if impossible
          const minProfitPercentAfterFees = 0.05; // 5% minimum profit after fees
          let adjustedQuantity = quantity;
          let attempts = 0;
          const maxAttempts = 10; // Prevent infinite loop

          while (attempts < maxAttempts && adjustedQuantity > 0) {
            const testTotalCost = adjustedQuantity * entryPrice * 1.02; // Entry + fee
            const testNetProfit = calculateNetProfit(
              entryPrice,
              exitPrice,
              adjustedQuantity
            );
            const testProfitPercent =
              testTotalCost > 0 ? (testNetProfit / testTotalCost) * 100 : 0;

            // If we meet 5% profit margin, we're good
            if (testProfitPercent >= minProfitPercentAfterFees * 100) {
              quantity = adjustedQuantity;
              break;
            }

            // If we don't meet 5%, reduce quantity by 10% and try again
            adjustedQuantity = Math.max(1, Math.floor(adjustedQuantity * 0.9));
            attempts++;
          }

          // Final check: if we still don't meet 5% with reduced quantity, use the best we can
          // But this will be filtered out later if it doesn't meet minimum profit percentage
          quantity = adjustedQuantity;
        } else {
          // For smaller capital, be more conservative with volume
          // Use 50-60% of available volume instead of 50% safety margin
          const volumeUsagePercent =
            maxTradeDurationDays >= 5
              ? 0.6 // 60% for 5+ day trades
              : maxTradeDurationDays >= 3
              ? 0.55 // 55% for 3-4 day trades
              : 0.5; // 50% for 1-2 day trades
          const availableVolume =
            avgDailyVolume * maxTradeDurationDays * volumeUsagePercent;
          const realisticQtySmall = Math.floor(availableVolume / 2);

          // Apply volume constraint
          quantity = Math.min(
            quantity, // Current quantity (may have been increased for profit)
            realisticQtySmall, // HARD LIMIT: Cannot exceed realistic volume
            maxQuantityByCapital // And not more than capital allows
          );

          // After reducing quantity for volume, verify we still meet minimum 5% profit margin
          const minProfitPercentAfterFees = 0.05; // 5% minimum profit after fees
          let adjustedQuantity = quantity;
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts && adjustedQuantity > 0) {
            const testTotalCost = adjustedQuantity * entryPrice * 1.02;
            const testNetProfit = calculateNetProfit(
              entryPrice,
              exitPrice,
              adjustedQuantity
            );
            const testProfitPercent =
              testTotalCost > 0 ? (testNetProfit / testTotalCost) * 100 : 0;

            if (testProfitPercent >= minProfitPercentAfterFees * 100) {
              quantity = adjustedQuantity;
              break;
            }

            adjustedQuantity = Math.max(1, Math.floor(adjustedQuantity * 0.9));
            attempts++;
          }

          quantity = adjustedQuantity;
        }
      }
    }

    // Don't enforce minimum of 1 if quantity is 0 due to capital constraints
    // If maxQuantityByCapital is 0 (single unit exceeds capital), return 0
    if (maxQuantityByCapital === 0) {
      return 0;
    }

    // Ensure minimum quantity of 1 for viable trades
    return Math.max(1, quantity);
  }

  /**
   * Generate explanation and benefits for the trading recommendation
   * @private
   */
  generateExplanation(
    signals,
    aggregated,
    historicalData,
    currentPrice,
    quantity,
    netProfit = 0,
    confidence = 0
  ) {
    const reasons = [];
    const benefits = [];
    const { maxTradeDurationDays, minProfitPerTrade, targetProfitPerTrade } =
      this.config.trading;

    // Count strategy votes
    const buySignals = signals.filter((s) => s.action === "BUY");
    const sellSignals = signals.filter((s) => s.action === "SELL");
    const holdSignals = signals.filter((s) => s.action === "HOLD");

    // Use the final action (may have been converted to HOLD)
    const finalAction = aggregated.action;

    if (finalAction === "BUY") {
      reasons.push(
        `${buySignals.length} of ${signals.length} strategies recommend BUY`
      );

      // Add strategy-specific reasons
      buySignals.forEach((signal) => {
        if (signal.strategy === "Momentum") {
          reasons.push("Strong upward momentum detected");
        } else if (signal.strategy === "MeanReversion") {
          reasons.push("Price below average - mean reversion opportunity");
        } else if (signal.strategy === "Volume") {
          reasons.push("High volume spike indicates strong interest");
        } else if (signal.strategy === "RSI") {
          reasons.push("RSI indicates oversold condition");
        } else if (signal.strategy === "MovingAverage") {
          reasons.push("Price above moving averages - bullish trend");
        } else if (signal.strategy === "SupportResistance") {
          reasons.push("Price near support level - bounce expected");
        }
      });

      // Add volume feasibility
      if (historicalData.length > 0 && maxTradeDurationDays) {
        const recentDays = Math.min(
          maxTradeDurationDays + 2,
          historicalData.length
        );
        const recentData = historicalData.slice(-recentDays);
        const volumes = recentData
          .map((d) => d.volume || 0)
          .filter((v) => v > 0);

        if (volumes.length > 0) {
          const avgDailyVolume =
            volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
          const requiredVolume = quantity * 2; // Buy + sell
          const availableVolume = avgDailyVolume * maxTradeDurationDays * 0.5; // 50% safety margin

          if (availableVolume >= requiredVolume) {
            reasons.push(
              `Volume sufficient for ${maxTradeDurationDays}-day completion (${Math.floor(
                avgDailyVolume
              ).toLocaleString()} avg daily volume)`
            );
          } else {
            reasons.push(
              `⚠️ Limited volume (${Math.floor(
                avgDailyVolume
              ).toLocaleString()}/day) may extend completion beyond ${maxTradeDurationDays} days`
            );
          }
        }
      }
    } else if (finalAction === "SELL") {
      reasons.push(
        `${sellSignals.length} of ${signals.length} strategies recommend SELL`
      );
      sellSignals.forEach((signal) => {
        if (signal.strategy === "Momentum") {
          reasons.push("Downward momentum detected");
        } else if (signal.strategy === "RSI") {
          reasons.push("RSI indicates overbought condition");
        } else if (signal.strategy === "SupportResistance") {
          reasons.push("Price near resistance level - reversal expected");
        }
      });
    } else {
      reasons.push(
        "Market conditions are neutral - waiting for better opportunity"
      );
    }

    // Generate benefits based on trade characteristics
    // Make benefits highly selective - only award to exceptional trades
    if (finalAction === "BUY") {
      // Count strategy votes for BUY
      const buySignals = signals.filter((s) => s.action === "BUY");
      const totalStrategies = signals.length;

      // Note: "Most Profitable" and "Best Value" are now percentile-based and assigned in TradingBot
      // SignalGenerator doesn't award them since it can't compare across all trades

      // Quickest flip - only for 1-day trades with high confidence
      // This is duration-based, not percentile-based, so keep it here
      if (maxTradeDurationDays === 1 && confidence >= 0.75) {
        benefits.push("Quick");
      }

      // Note: "Highest Confidence" is calculated in TradingBot per duration group
      // SignalGenerator doesn't award it since it can't compare across trades

      // Note: "High Volume" is now percentile-based and assigned in TradingBot
      // SignalGenerator doesn't award it since it can't compare across all trades

      // Note: "Highest Profit Per Month" is calculated in TradingBot after comparing all recommendations
      // SignalGenerator doesn't award "Highest" since it can't compare across all trades
    }

    return {
      explanation: reasons.join(". ") + ".",
      benefits: benefits.length > 0 ? benefits.join(", ") : "",
    };
  }

  /**
   * Calculate realistic exit price based on historical data
   * Caps profit targets at reasonable levels (5-15%)
   * @private
   */
  calculateRealisticExitPrice(
    historicalData,
    currentPrice,
    suggestedExitPrice
  ) {
    if (!suggestedExitPrice || suggestedExitPrice <= currentPrice) {
      // Default: 10% profit target
      return currentPrice * 1.1;
    }

    const { profitTargetPercent, maxTradeDurationDays } = this.config.trading;

    // Calculate historical price range
    const prices = historicalData.map((d) => d.price);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // For quick flips (2 days), check recent price volatility
    // Calculate average daily price change over last N days (where N = maxTradeDurationDays)
    const recentDays = Math.min(
      maxTradeDurationDays,
      historicalData.length - 1
    );
    let avgDailyChange = 0;
    if (recentDays > 0) {
      const recentChanges = [];
      for (
        let i = historicalData.length - recentDays;
        i < historicalData.length;
        i++
      ) {
        if (i > 0) {
          const change =
            Math.abs(historicalData[i].price - historicalData[i - 1].price) /
            historicalData[i - 1].price;
          recentChanges.push(change);
        }
      }
      if (recentChanges.length > 0) {
        avgDailyChange =
          recentChanges.reduce((sum, c) => sum + c, 0) / recentChanges.length;
      }
    }

    // Cap exit price at reasonable profit targets from settings
    const maxProfitPercent = profitTargetPercent.max;
    const minProfitPercent = profitTargetPercent.min;

    // Adjust max profit based on recent volatility and trade duration
    // For 2-day flips, use recent volatility as guide but allow up to 20% if data supports
    const maxForQuickFlips =
      maxTradeDurationDays === 2
        ? Math.min(0.2, maxProfitPercent)
        : maxProfitPercent;
    const volatilityBasedMax = avgDailyChange * maxTradeDurationDays * 1.5; // 1.5x for safety
    const adjustedMaxProfit = Math.min(
      maxForQuickFlips,
      volatilityBasedMax || maxForQuickFlips
    );

    const maxRealisticExit = currentPrice * (1 + adjustedMaxProfit);
    const minRealisticExit = currentPrice * (1 + minProfitPercent);

    // Don't exceed historical max by more than 10% (stricter for realism)
    const historicalMaxCap = maxPrice * 1.1; // Allow 10% above historical max

    // Start with suggested exit price if valid, otherwise use max realistic
    let realisticExit =
      suggestedExitPrice && suggestedExitPrice > currentPrice
        ? suggestedExitPrice
        : maxRealisticExit;

    // Apply all caps - don't exceed any of them
    realisticExit = Math.min(realisticExit, maxRealisticExit, historicalMaxCap);

    // If current price is below average, consider targeting average price (mean reversion)
    // But always respect the 15% profit cap
    if (currentPrice < avgPrice * 0.9) {
      const meanTarget = Math.min(avgPrice * 1.05, maxRealisticExit);
      // Use mean target if it's lower than current realistic exit
      realisticExit = Math.min(realisticExit, meanTarget);
    }

    // Ensure minimum profit target
    if (realisticExit < minRealisticExit) {
      realisticExit = minRealisticExit;
    }

    // Final check: ensure we never exceed the max profit cap (safety check)
    realisticExit = Math.min(realisticExit, maxRealisticExit);

    return Math.round(realisticExit * 100) / 100; // Round to 2 decimals
  }
}
