import readline from "readline";
import { TradeMemory } from "./TradeMemory.js";
import chalk from "chalk";
import { formatGP } from "../utils/formatGP.js";
import { calculateGEFee } from "../utils/GEFee.js";

/**
 * TradeManager - Interactive CLI for managing approved trades
 * Handles user input for approving/denying recommendations and managing trades
 */
export class TradeManager {
  constructor(rl = null) {
    this.memory = new TradeMemory();
    this.rl =
      rl ||
      readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
  }

  /**
   * Initialize and load memory
   */
  async initialize() {
    await this.memory.load();
  }

  /**
   * Format a trade for display
   * @param {Object} trade - Trade object
   * @param {number} index - Display index
   * @returns {string} Formatted trade string
   */
  formatTrade(trade, index) {
    const actionColor = trade.action === "buy" ? chalk.green : chalk.red;
    return `${index}. ${actionColor(trade.action.toUpperCase())} ${chalk.cyan(
      trade.item
    )} - Qty: ${chalk.yellow(trade.quantity)} @ ${chalk.yellow(
      formatGP(trade.price)
    )}`;
  }

  /**
   * Display recommendation in compact format
   * Format: "19. Turquoise robe top - 17,187x at 11M gp for 709K gp profit (10.89%)"
   * @param {Object} rec - Recommendation object
   * @param {number} index - Display index
   */
  displayCompactRecommendation(rec, index) {
    const quantity = rec.quantity || 0;
    const totalCost = rec.totalCost || 0;
    const netProfit = rec.netProfit || 0;
    const entryPrice = rec.entryPrice || rec.price || 0;
    const exitPrice = rec.exitPrice || entryPrice;

    // Calculate profit margin as (netProfit / totalCost) * 100
    // This accounts for fees, unlike the simple per-unit price difference
    const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    // Handle benefits
    let benefitsStr = "";
    if (rec.benefits) {
      if (Array.isArray(rec.benefits)) {
        const filtered = rec.benefits.filter(
          (b) => b !== "Standard Trade" && b !== ""
        );
        benefitsStr =
          filtered.length > 0
            ? ` ${chalk.magenta("[" + filtered.join(", ") + "]")}`
            : "";
      } else if (
        typeof rec.benefits === "string" &&
        rec.benefits !== "Standard Trade" &&
        rec.benefits !== ""
      ) {
        benefitsStr = ` ${chalk.magenta("[" + rec.benefits + "]")}`;
      }
    }

    // Format: "19. Turquoise robe top - 17,187x at 11M gp for 709K gp profit (10.89%)"
    const quantityStr = `${quantity.toLocaleString()}x`;
    const costStr =
      totalCost > 0 ? ` at ${chalk.yellow(formatGP(totalCost))} gp` : "";
    const profitStr =
      netProfit !== 0
        ? ` for ${
            netProfit > 0
              ? chalk.green(formatGP(netProfit))
              : chalk.red(formatGP(netProfit))
          } gp profit`
        : "";
    const marginStr =
      profitPercent > 0
        ? ` ${chalk.cyan(`(${profitPercent.toFixed(2)}%)`)}`
        : "";

    console.log(
      `${index}. ${chalk.cyan(rec.item)}${benefitsStr} - ${chalk.white(
        quantityStr
      )}${costStr}${profitStr}${marginStr}`
    );
  }

  /**
   * Display detailed recommendation
   * @param {Object} rec - Recommendation object
   * @param {number} index - Display index
   */
  displayDetailedRecommendation(rec, index) {
    // Use executionPlan.totalDays if available, otherwise rec.duration, default to 1
    const duration = rec.executionPlan?.totalDays || rec.duration || 1;

    // Calculate profit per month
    const netProfit =
      rec.netProfit ||
      (rec.exitPrice && rec.entryPrice && rec.quantity
        ? (rec.exitPrice - rec.entryPrice) * rec.quantity
        : 0);
    const profitPerMonth = netProfit ? netProfit * (30 / duration) : 0;

    // Calculate profit margin as (netProfit / totalCost) * 100
    // This accounts for fees, unlike the simple per-unit price difference
    const entryPrice = rec.entryPrice || rec.price || 0;
    const exitPrice = rec.exitPrice || entryPrice;
    const totalCost = rec.totalCost || (rec.quantity || 0) * entryPrice;
    const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    // Handle benefits
    let benefitsStr = "";
    if (rec.benefits) {
      if (Array.isArray(rec.benefits)) {
        const filtered = rec.benefits.filter((b) => b !== "Standard Trade");
        benefitsStr =
          filtered.length > 0
            ? ` ${chalk.magenta("[" + filtered.join(", ") + "]")}`
            : "";
      } else if (
        typeof rec.benefits === "string" &&
        rec.benefits !== "Standard Trade"
      ) {
        benefitsStr = ` ${chalk.magenta("[" + rec.benefits + "]")}`;
      }
    }

    // Combine item name with quantity, cost, profit, and margin in first line
    // Format: "19. Turquoise robe top - 17,187x at 11M gp for 709K gp profit (10.89%)"
    const quantityStr = `${(rec.quantity || 0).toLocaleString()}x`;
    const costStr = rec.totalCost
      ? ` at ${chalk.yellow(formatGP(rec.totalCost))} gp`
      : "";
    const profitStr =
      netProfit !== undefined && netProfit !== 0
        ? ` for ${
            netProfit > 0
              ? chalk.green(formatGP(netProfit))
              : chalk.red(formatGP(netProfit))
          } gp profit`
        : "";
    const marginStr =
      profitPercent > 0
        ? ` ${chalk.cyan(`(${profitPercent.toFixed(2)}%)`)}`
        : "";
    console.log(
      `\n${index}. ${chalk.bold(rec.item)}${benefitsStr} - ${chalk.white(
        quantityStr
      )}${costStr}${profitStr}${marginStr}`
    );
    // Calculate total fees lost (2% on buy + 2% on sell)
    const quantity = rec.quantity || 0;
    let totalFees = 0;
    if (entryPrice && exitPrice && quantity > 0) {
      const entryCost = entryPrice * quantity;
      const exitRevenue = exitPrice * quantity;
      const entryFee = calculateGEFee(entryCost, entryPrice);
      const exitFee = calculateGEFee(exitRevenue, exitPrice);
      totalFees = entryFee + exitFee;
    }

    // Get total days from execution plan if available, otherwise use duration
    const totalDays = rec.executionPlan?.totalDays || duration;
    const feesStr =
      totalFees > 0
        ? ` | ${chalk.red(`💸 ${formatGP(Math.floor(totalFees))} fees`)}`
        : "";
    console.log(
      `   ${chalk.cyan(`⏱️ Total ${totalDays}d`)} | ${chalk.green(
        `💰 ${formatGP(Math.floor(profitPerMonth))}/mo`
      )} | ${chalk.white(
        `💵 ${formatGP(Math.floor(rec.currentPrice || rec.price || 0))} gp`
      )}${feesStr}`
    );

    // Compact entry/exit/stop loss - show full numbers with commas (no rounding/formatting)
    if (rec.entryPrice && rec.exitPrice) {
      const stopLossText = rec.stopLoss
        ? ` | ${chalk.red(`🛑 ${Math.floor(rec.stopLoss).toLocaleString()}`)}`
        : "";
      console.log(
        `   ${chalk.green(
          `📥 ${Math.floor(entryPrice).toLocaleString()}`
        )} → ${chalk.green(
          `📤 ${Math.floor(rec.exitPrice).toLocaleString()}`
        )}${stopLossText}`
      );
    } else if (rec.entryPrice) {
      console.log(
        `   ${chalk.green(
          `📥 Entry: ${Math.floor(entryPrice).toLocaleString()} gp`
        )}`
      );
    }

    // Display execution plan if available
    if (rec.executionPlan && rec.executionPlan.plan) {
      const plan = rec.executionPlan;
      const planColor =
        plan.executionRisk === "high"
          ? chalk.red
          : plan.executionRisk === "medium"
          ? chalk.yellow
          : chalk.green;
      const riskEmoji =
        plan.executionRisk === "high"
          ? "🔴"
          : plan.executionRisk === "medium"
          ? "🟡"
          : "🟢";

      if (plan.breakdown) {
        const b = plan.breakdown;
        const holdText =
          b.hold.days > 0 ? ` | ${chalk.gray(`⏸️ Hold ${b.hold.days}d`)}` : "";
        const riskText =
          plan.executionRisk !== "low" ? ` ${planColor(riskEmoji)}` : "";
        console.log(
          `   ${chalk.bold("📋 Plan:")} ${planColor(
            `📥 Buy ${b.buy.days}d (${b.buy.volumePercent.toFixed(
              1
            )}%/day)${holdText} | 📤 Sell ${
              b.sell.days
            }d (${b.sell.volumePercent.toFixed(1)}%/day)${riskText}`
          )}`
        );
      } else {
        console.log(
          `   ${chalk.bold("📋 Plan:")} ${planColor(
            `${riskEmoji} ${plan.plan}`
          )}`
        );
      }
    }

    // Market cap and volume analysis (hedge fund style metrics)
    if (rec.historicalData && rec.historicalData.length > 0) {
      const currentPrice = rec.currentPrice || rec.price || entryPrice;
      const volumes = rec.historicalData
        .map((d) => d.volume || 0)
        .filter((v) => v > 0);

      if (volumes.length > 0) {
        // Use avgDailyVolume from signal if available (calculated from recent days)
        // Otherwise calculate from all historical data
        const avgDailyVolume =
          rec.avgDailyVolume ||
          volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

        // Calculate market cap (current price * average daily volume)
        const marketCap = currentPrice * avgDailyVolume;

        // Volume over different time periods
        const last7Days = rec.historicalData.slice(-7);
        const last30Days = rec.historicalData;
        const volume7d = last7Days
          .map((d) => d.volume || 0)
          .filter((v) => v > 0);
        const volume30d = last30Days
          .map((d) => d.volume || 0)
          .filter((v) => v > 0);
        const avgVolume7d =
          volume7d.length > 0
            ? volume7d.reduce((sum, v) => sum + v, 0) / volume7d.length
            : 0;
        const avgVolume30d =
          volume30d.length > 0
            ? volume30d.reduce((sum, v) => sum + v, 0) / volume30d.length
            : 0;

        // Volume trend (7d vs 30d)
        const volumeChange = avgVolume7d - avgVolume30d;
        const volumeTrendPercent =
          avgVolume30d > 0
            ? Math.round((volumeChange / avgVolume30d) * 100 * 10) / 10 // Round to 1 decimal
            : 0;
        const trendColor =
          volumeTrendPercent > 0
            ? chalk.green
            : volumeTrendPercent < 0
            ? chalk.red
            : chalk.grey;
        const changeSign = volumeChange > 0 ? "+" : "";
        const changeText =
          volumeChange !== 0
            ? ` (${changeSign}${Math.round(volumeChange).toLocaleString()}/day)`
            : "";

        // Calculate volume feasibility based on trade duration
        // Show both daily percentage AND whether it's feasible over the duration
        // If buy and sell happen on different days, we only need max(buy/day, sell/day), not buy+sell

        // Get trade duration (from rec.duration or estimate from expected duration)
        // Must be declared before it's used in calculations
        let tradeDurationDays = 5; // Default
        if (rec.duration) {
          tradeDurationDays = rec.duration;
        } else if (rec.executionPlan && rec.executionPlan.totalDays) {
          tradeDurationDays = rec.executionPlan.totalDays;
        } else if (rec.expectedDuration) {
          // Parse "≤ 5 days" or "≤ 3 days" etc.
          const match = rec.expectedDuration.match(/(\d+)/);
          if (match) {
            tradeDurationDays = parseInt(match[1]);
          }
        }

        const executionPlan = rec.executionPlan;
        let requiredVolume = (rec.quantity || 0) * 2; // Default: assume buy and sell overlap

        if (
          executionPlan &&
          executionPlan.buyDays > 0 &&
          executionPlan.sellDays > 0
        ) {
          // Buy and sell happen on different days
          // We need max(buy volume per day, sell volume per day) * number of days
          const buyVolumePerDay =
            executionPlan.buyDays > 0
              ? (rec.quantity || 0) / executionPlan.buyDays
              : 0;
          const sellVolumePerDay =
            executionPlan.sellDays > 0
              ? (rec.quantity || 0) / executionPlan.sellDays
              : 0;
          const maxDailyVolumeNeeded = Math.max(
            buyVolumePerDay,
            sellVolumePerDay
          );
          // Required volume is the max daily volume needed, not the sum
          requiredVolume = maxDailyVolumeNeeded * tradeDurationDays;
        } else {
          // If no execution plan or they happen on same day, use quantity * 2
          requiredVolume = (rec.quantity || 0) * 2;
        }
        const dailyPercent =
          avgDailyVolume > 0
            ? ((requiredVolume / avgDailyVolume) * 100).toFixed(1)
            : 0;

        // Calculate available volume over the trade duration
        // Use the same percentages as SignalGenerator for consistency
        // SignalGenerator limits to 50-70%, so show what's actually "safe" to use
        const volumeUsagePercent =
          tradeDurationDays >= 5 ? 0.7 : tradeDurationDays >= 3 ? 0.6 : 0.5;
        const availableOverDuration =
          avgDailyVolume * tradeDurationDays * volumeUsagePercent;
        const isFeasible = availableOverDuration >= requiredVolume;
        const feasibilityPercent =
          availableOverDuration > 0
            ? ((requiredVolume / availableOverDuration) * 100).toFixed(1)
            : 0;

        // Color based on feasibility over duration:
        // < 70% = green (safe), 70-80% = yellow (caution), 80-100% = yellow (risky), > 100% = red (unfeasible)
        const feasibilityNum = parseFloat(feasibilityPercent);
        const getFeasibilityColor = (num) => {
          if (num <= 70) {
            return chalk.green;
          } else if (num <= 80) {
            return chalk.yellow;
          } else if (num <= 100) {
            return chalk.yellow.bold; // Bold yellow for risky but feasible
          } else if (num <= 150) {
            return chalk.red;
          } else {
            return chalk.red.bold;
          }
        };
        const feasibleText = isFeasible
          ? chalk.green("✓ Feasible")
          : chalk.red("✗ Not Feasible");

        const feasibilityEmoji = isFeasible ? "✅" : "❌";
        console.log(
          `   ${chalk.bold("📊 Market:")} ${chalk.cyan(
            `🧢 ${formatGP(Math.floor(marketCap))}`
          )} | ${chalk.white(`📦 ${avgDailyVolume.toLocaleString()}/day`)}`
        );
        console.log(
          `   ${chalk.bold("📈 Trend:")} ${trendColor(
            `${
              volumeTrendPercent > 0
                ? "📈"
                : volumeTrendPercent < 0
                ? "📉"
                : "➡️"
            } ${
              volumeTrendPercent > 0 ? "+" : ""
            }${volumeTrendPercent}%${changeText}`
          )} ${chalk.gray(
            `(7d: ${Math.round(
              avgVolume7d
            ).toLocaleString()} vs 30d: ${Math.round(
              avgVolume30d
            ).toLocaleString()})`
          )}`
        );
        // Calculate required volume based on execution plan (continued)
        // If buy and sell happen on different days, we don't need to double the volume
        const quantity = rec.quantity || 0;
        let maxDailyVolumeNeeded = quantity; // Default: assume buy and sell can overlap

        if (
          executionPlan &&
          executionPlan.buyDays > 0 &&
          executionPlan.sellDays > 0
        ) {
          // Buy and sell happen on different days, so we only need max(buy volume/day, sell volume/day)
          const buyVolumePerDay =
            executionPlan.buyDays > 0 ? quantity / executionPlan.buyDays : 0;
          const sellVolumePerDay =
            executionPlan.sellDays > 0 ? quantity / executionPlan.sellDays : 0;
          maxDailyVolumeNeeded = Math.max(buyVolumePerDay, sellVolumePerDay);
        } else {
          // If no execution plan or they happen on same day, use quantity * 2
          maxDailyVolumeNeeded = quantity * 2;
        }

        // Recalculate feasibility with correct volume requirement
        // If buy and sell are on different days, we need max per day, not total
        // Available volume per day is avgDailyVolume * volumeUsagePercent
        const availableVolumePerDay = avgDailyVolume * volumeUsagePercent;
        const actualRequiredVolume =
          executionPlan &&
          executionPlan.buyDays > 0 &&
          executionPlan.sellDays > 0
            ? maxDailyVolumeNeeded * tradeDurationDays // Max per day * days
            : quantity * 2; // Buy + sell if they overlap

        // Feasibility is based on whether max daily volume needed fits in daily available
        const actualFeasibilityPercent =
          availableVolumePerDay > 0
            ? ((maxDailyVolumeNeeded / availableVolumePerDay) * 100).toFixed(1)
            : 0;
        const actualFeasibilityNum = parseFloat(actualFeasibilityPercent);
        const actualIsFeasible = maxDailyVolumeNeeded <= availableVolumePerDay;
        const actualFeasibleText = actualIsFeasible
          ? chalk.green("✓ Feasible")
          : chalk.red("✗ Not Feasible");

        // Display text based on whether buy and sell are on different days
        let reqVolumeText;
        if (
          executionPlan &&
          executionPlan.buyDays > 0 &&
          executionPlan.sellDays > 0
        ) {
          // Buy and sell on different days - show max per day
          reqVolumeText = `${Math.ceil(
            maxDailyVolumeNeeded
          ).toLocaleString()}/day max`;
        } else {
          // Buy and sell overlap - show total
          reqVolumeText =
            quantity === 1
              ? `1 buy+1 sell`
              : `${quantity.toLocaleString()} buy+${quantity.toLocaleString()} sell`;
        }
        const feasibilityColorFn = getFeasibilityColor(actualFeasibilityNum);
        console.log(
          `   ${chalk.bold("⚖️ Feasibility:")} ${feasibilityColorFn(
            actualFeasibilityPercent
          )}% of daily volume ${chalk.gray(
            `(${reqVolumeText} vs ${Math.floor(
              availableVolumePerDay
            ).toLocaleString()}/day avail)`
          )} ${actualFeasibleText}`
        );
        if (parseFloat(dailyPercent) > 100) {
          console.log(
            `   ${chalk.gray(
              `   ℹ️ ${dailyPercent}% daily volume spread over ${tradeDurationDays} days`
            )}`
          );
        }

        // Warn about high volume usage (> 80%)
        if (feasibilityNum > 80 && feasibilityNum <= 100) {
          console.log(
            `   ${chalk.yellow(
              `⚠️ High execution risk - may not fulfill fully`
            )}`
          );
        }
      }
    }

    // Show overall confidence calculation above "Why"
    if (rec.strategySignals && rec.strategySignals.length > 0) {
      const activeSignals = rec.strategySignals.filter(
        (s) => s.action === "BUY"
      );
      if (activeSignals.length > 0) {
        const overallConfidence = rec.confidence || 0;
        const overallPercent = Math.round(overallConfidence * 100);

        // Show simplified explanation
        // The actual calculation uses normalized/weighted averages + boost, which is complex
        // So we just show the final confidence and how many strategies contributed
        const strategyCount = activeSignals.length;
        const strategyText =
          strategyCount === 1 ? "1 strategy" : `${strategyCount} strategies`;

        // Show if there's a boost (multiple strategies agree)
        const hasBoost = strategyCount > 1;
        const boostText = hasBoost ? " (consensus boost)" : "";

        console.log(
          `   ${chalk.bold("🎯 Confidence:")} ${chalk.cyan(
            `${overallPercent}%`
          )} ${chalk.gray(`(${strategyText}${boostText})`)}`
        );
      }
    }

    // Display strategies with confidence scores (compact)
    if (rec.strategySignals && rec.strategySignals.length > 0) {
      const strategyNames = [
        "Momentum",
        "MeanReversion",
        "Volume",
        "RSI",
        "MovingAverage",
        "SupportResistance",
      ];
      const strategyDisplay = strategyNames.map((name) => {
        const signal = rec.strategySignals.find((s) => s.strategy === name);
        if (!signal) return chalk.grey(name);

        if (signal.action === "BUY") {
          const confidence = signal.confidence || 0;
          const confidencePercent = Math.round(confidence * 100);
          // Color based on confidence: darker green = higher confidence
          const confidenceColor =
            confidence >= 0.8
              ? chalk.green.bold
              : confidence >= 0.6
              ? chalk.green
              : chalk.green.dim;
          return `${confidenceColor(name)} (${confidencePercent}%)`;
        } else {
          return chalk.grey(name);
        }
      });

      console.log(
        `   ${chalk.bold("🔬 Strategies:")} ${strategyDisplay.join(", ")}`
      );
    } else if (rec.strategies && rec.strategies.length > 0) {
      // Fallback to old format if strategySignals not available
      const strategyNames = rec.strategies;
      const strategySignals = rec.strategySignals || [];

      // Create a map of strategy name to signal data
      const signalMap = new Map();
      strategySignals.forEach((signal) => {
        signalMap.set(signal.strategy, signal);
      });

      // Color each strategy based on whether it's active and its confidence
      const coloredStrategies = strategyNames.map((strategyName) => {
        const signal = signalMap.get(strategyName);

        if (!signal) {
          return chalk.grey(strategyName);
        }

        const isActive = signal.action === "BUY";
        if (!isActive) {
          return chalk.grey(strategyName);
        }

        const confidence = signal.confidence || 0;
        const confidencePercent = Math.round(confidence * 100);
        const strategyWithScore = `${strategyName} (${confidencePercent}%)`;

        if (confidence >= 0.8) {
          return chalk.green.bold(strategyWithScore);
        } else if (confidence >= 0.6) {
          return chalk.green(strategyWithScore);
        } else {
          return chalk.green.dim(strategyWithScore);
        }
      });

      console.log(
        `   ${chalk.bold("🔬 Strategies:")} ${coloredStrategies.join(
          chalk.grey(", ")
        )}`
      );
    }

    if (rec.explanation) {
      console.log(`   ${chalk.bold("💡 Why:")} ${rec.explanation}`);
    }
  }

  /**
   * Display current trades
   */
  displayTrades() {
    if (this.memory.trades.length === 0) {
      console.log(chalk.gray("  No active trades"));
      return;
    }

    console.log(chalk.blue("\n📋 Current Active Trades:"));
    this.memory.trades.forEach((trade, i) => {
      console.log(`  ${this.formatTrade(trade, i)}`);
    });
  }

  /**
   * Display recommendations and get user approval
   * @param {Array} recommendations - Array of trade recommendations
   * @param {boolean} skipInteractive - Skip interactive prompt
   * @param {Settings} settings - Settings object (optional)
   * @returns {Promise<{approved: Array, needsRefresh: boolean}>} Object with approved trades and refresh flag
   */
  async promptForApproval(
    recommendations,
    skipInteractive = false,
    settings = null
  ) {
    if (recommendations.length === 0) {
      console.log(chalk.yellow("⚠️  No trade recommendations available."));
      return { approved: [], needsRefresh: false };
    }

    // Sort by confidence (highest first) and display in single list
    const sortedRecs = [...recommendations].sort(
      (a, b) => (b.confidence || 0) - (a.confidence || 0)
    );

    console.log(
      chalk.bold(
        `\n📊 Top ${sortedRecs.length} Recommendations (Ranked by Confidence):`
      )
    );
    console.log(chalk.gray("─".repeat(80)));

    sortedRecs.forEach((rec, i) => {
      this.displayDetailedRecommendation(rec, i);
    });

    // Skip interactive prompt if requested
    if (skipInteractive) {
      return { approved: [], needsRefresh: false };
    }

    console.log(chalk.gray("\nCommands:"));
    console.log(chalk.gray("  A<number> - Approve trade (e.g., A0, A1)"));
    console.log(chalk.gray("  D<number> - Deny trade (e.g., D0, D1)"));
    console.log(chalk.gray("  M - Manage current trades"));
    console.log(chalk.gray("  S - Settings"));
    console.log(chalk.gray("  Q - Quit/Continue"));

    return new Promise((resolve) => {
      // Track approved trades in this session
      const approvedTrades = [];

      const handleAnswer = async (answer) => {
        const trimmed = answer.trim().toUpperCase();

        if (trimmed === "Q") {
          resolve({ approved: approvedTrades, needsRefresh: false });
          return;
        }

        if (trimmed === "M") {
          await this.manageTrades();
          // Continue prompting after managing trades
          const result = await this.promptForApproval(
            recommendations,
            skipInteractive,
            settings
          );
          // Merge approved trades from recursive call
          approvedTrades.push(...(result.approved || []));
          resolve({
            approved: approvedTrades,
            needsRefresh: result.needsRefresh || false,
          });
          return;
        }

        if (trimmed === "S") {
          if (settings) {
            const settingsChanged = await this.showSettingsMenu(settings);
            // Continue prompting after settings
            const result = await this.promptForApproval(
              recommendations,
              skipInteractive,
              settings
            );
            // Merge approved trades from recursive call
            approvedTrades.push(...(result.approved || []));
            // Only mark refresh as needed if settings actually changed
            // Don't propagate needsRefresh from recursive call - that's for nested settings menus
            if (settingsChanged) {
              resolve({ approved: approvedTrades, needsRefresh: true });
            } else {
              // Settings didn't change, so no refresh needed regardless of recursive result
              resolve({
                approved: approvedTrades,
                needsRefresh: false,
              });
            }
            return;
          } else {
            console.log(chalk.red("Settings not available"));
            // Continue prompting
            const result = await this.promptForApproval(
              recommendations,
              skipInteractive,
              settings
            );
            approvedTrades.push(...(result.approved || []));
            // Don't propagate needsRefresh from recursive call when settings not available
            resolve({
              approved: approvedTrades,
              needsRefresh: false,
            });
            return;
          }
        }

        // Parse A/D commands
        const match = trimmed.match(/^([AD])(\d+)$/);
        if (match) {
          const action = match[1];
          const index = parseInt(match[2]);

          if (index >= 0 && index < recommendations.length) {
            if (action === "A") {
              // Approve trade
              const rec = recommendations[index];
              const trade = {
                item: rec.item,
                action: rec.action,
                quantity: rec.quantity,
                price: rec.price,
                index: this.memory.trades.length,
              };

              if (this.memory.trades.length >= this.memory.maxTrades) {
                console.log(
                  chalk.red(
                    `Cannot add more than ${this.memory.maxTrades} trades (max GE slots)`
                  )
                );
              } else {
                this.memory.addTrade(trade);
                await this.memory.save();
                console.log(chalk.green(`✓ Approved: ${rec.item}`));
                // Track approved trade
                approvedTrades.push(trade);
              }
            } else {
              console.log(chalk.gray(`Denied: ${recommendations[index].item}`));
            }
          } else {
            console.log(chalk.red(`Invalid index: ${index}`));
          }
        }

        // Continue prompting
        this.rl.question(chalk.yellow("\n> "), handleAnswer);
      };

      this.rl.question(chalk.yellow("\n> "), handleAnswer);
    });
  }

  /**
   * Interactive trade management
   */
  async manageTrades() {
    while (true) {
      console.log(chalk.blue("\n🔧 Trade Management:"));
      this.displayTrades();

      console.log(chalk.gray("\nCommands:"));
      console.log(chalk.gray("  E<number> - Edit trade (e.g., E0)"));
      console.log(chalk.gray("  D<number> - Delete trade (e.g., D0)"));
      console.log(chalk.gray("  A - Add new trade manually"));
      console.log(chalk.gray("  Q - Quit management"));

      const answer = await new Promise((resolve) => {
        this.rl.question(chalk.yellow("\n> "), resolve);
      });

      const trimmed = answer.trim().toUpperCase();

      if (trimmed === "Q") {
        break;
      }

      if (trimmed === "A") {
        await this.addTradeManually();
        continue;
      }

      const match = trimmed.match(/^([ED])(\d+)$/);
      if (match) {
        const action = match[1];
        const index = parseInt(match[2]);

        if (!this.isValidIndex(index)) {
          console.log(chalk.red(`Invalid index: ${index}`));
          continue;
        }

        if (action === "E") {
          await this.editTrade(index);
        } else if (action === "D") {
          this.memory.deleteTrade(index);
          await this.memory.save();
          console.log(chalk.green(`✓ Deleted trade ${index}`));
        }
      }
    }
  }

  /**
   * Edit a trade interactively
   */
  async editTrade(index) {
    const trade = this.memory.getTrade(index);
    if (!trade) {
      console.log(chalk.red(`Trade ${index} not found`));
      return;
    }

    console.log(chalk.blue(`\nEditing trade ${index}:`));
    console.log(this.formatTrade(trade, index));

    const priceAnswer = await new Promise((resolve) => {
      this.rl.question(
        chalk.yellow(`New price (current: ${trade.price}): `),
        resolve
      );
    });

    const quantityAnswer = await new Promise((resolve) => {
      this.rl.question(
        chalk.yellow(`New quantity (current: ${trade.quantity}): `),
        resolve
      );
    });

    const updates = {};
    if (priceAnswer.trim()) {
      const price = parseInt(priceAnswer.trim());
      if (!isNaN(price)) {
        updates.price = price;
      }
    }
    if (quantityAnswer.trim()) {
      const quantity = parseInt(quantityAnswer.trim());
      if (!isNaN(quantity)) {
        updates.quantity = quantity;
      }
    }

    if (Object.keys(updates).length > 0) {
      this.memory.updateTrade(index, updates);
      await this.memory.save();
      console.log(chalk.green(`✓ Updated trade ${index}`));
    }
  }

  /**
   * Add a trade manually
   */
  async addTradeManually() {
    if (this.memory.trades.length >= this.memory.maxTrades) {
      console.log(
        chalk.red(
          `Cannot add more than ${this.memory.maxTrades} trades (max GE slots)`
        )
      );
      return;
    }

    const item = await new Promise((resolve) => {
      this.rl.question(chalk.yellow("Item name: "), resolve);
    });

    const action = await new Promise((resolve) => {
      this.rl.question(chalk.yellow("Action (buy/sell): "), resolve);
    });

    const quantity = await new Promise((resolve) => {
      this.rl.question(chalk.yellow("Quantity: "), resolve);
    });

    const price = await new Promise((resolve) => {
      this.rl.question(chalk.yellow("Price: "), resolve);
    });

    const trade = {
      item: item.trim(),
      action: action.trim().toLowerCase(),
      quantity: parseInt(quantity.trim()) || 0,
      price: parseInt(price.trim()) || 0,
      index: this.memory.trades.length,
    };

    this.memory.addTrade(trade);
    await this.memory.save();
    console.log(chalk.green(`✓ Added trade: ${trade.item}`));
  }

  /**
   * Check if index is valid
   */
  isValidIndex(index) {
    return index >= 0 && index < this.memory.trades.length;
  }

  /**
   * Show settings submenu
   * @param {Settings} settings - Settings object
   * @returns {Promise<boolean>} True if settings were changed, false otherwise
   */
  async showSettingsMenu(settings) {
    let settingsChanged = false;

    while (true) {
      console.log(chalk.blue("\n⚙️  Settings:"));
      const config = settings.getConfig();
      const membersStatus = config.data.includeMembersItems
        ? chalk.green("ON")
        : chalk.red("OFF");
      console.log(chalk.gray(`  Members Items: ${membersStatus}`));
      console.log(chalk.gray("\nCommands:"));
      console.log(chalk.gray("  M - Toggle Members Items"));
      console.log(chalk.gray("  Q - Back to main menu"));

      const answer = await new Promise((resolve) => {
        this.rl.question(chalk.yellow("\n> "), resolve);
      });

      const trimmed = answer.trim().toUpperCase();

      if (trimmed === "Q") {
        break;
      }

      if (trimmed === "M") {
        config.data.includeMembersItems = !config.data.includeMembersItems;
        await settings.save();
        settingsChanged = true; // Mark that settings were changed
        const newStatus = config.data.includeMembersItems
          ? chalk.green("ON")
          : chalk.red("OFF");
        console.log(
          chalk.green(
            `✓ Members Items ${
              config.data.includeMembersItems ? "enabled" : "disabled"
            }`
          )
        );
        console.log(
          chalk.gray(
            `  Current status: ${newStatus} (${
              config.data.includeMembersItems ? "Includes" : "F2P only"
            })`
          )
        );
      } else {
        console.log(chalk.red(`Invalid command: ${trimmed}`));
      }
    }

    return settingsChanged;
  }

  /**
   * Close readline interface
   */
  close() {
    this.rl.close();
  }
}
