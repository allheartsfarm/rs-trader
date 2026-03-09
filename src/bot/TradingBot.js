import chalk from "chalk";
import { SignalGenerator } from "../algorithms/SignalGenerator.js";
import { DataFetcher } from "../data/DataFetcher.js";
import { PositionManager } from "./PositionManager.js";
import { Settings } from "../config/Settings.js";
import { formatGP } from "../utils/formatGP.js";
import { TradeManager } from "./TradeManager.js";

/**
 * TradingBot - Main bot that coordinates data fetching, signal generation, and position management
 */
export class TradingBot {
  constructor({
    dataFetcher,
    signalGenerator,
    positionManager,
    settings = null,
    minConfidence = null,
    tradeManager = null,
  }) {
    this.settings = settings || new Settings();
    this.config = this.settings.getConfig();
    this.dataFetcher = dataFetcher || new DataFetcher();
    this.signalGenerator =
      signalGenerator || new SignalGenerator(this.settings);
    this.positionManager =
      positionManager || new PositionManager(this.config.trading.maxPositions);
    this.minConfidence = minConfidence || this.config.trading.minConfidence;
    this.tradeManager = tradeManager || new TradeManager();
  }

  /**
   * Start the trading bot
   */
  async start() {
    // Initialize trade manager
    await this.tradeManager.initialize();

    // Display current trades
    this.tradeManager.displayTrades();
    console.log(chalk.green("🤖 Trading Bot Started"));
    console.log(
      chalk.yellow(
        `📊 F2P Mode: Max ${this.positionManager.maxPositions} positions`
      )
    );
    console.log(
      chalk.cyan(
        `⏱️  Max Trade Duration: ${this.config.trading.maxTradeDurationDays} days (quick flips)\n`
      )
    );

    // Fetch all tradeable items from the API
    // Strategy: Load F2P immediately, members in background for instant toggling
    console.log(chalk.blue("📦 Fetching all tradeable items..."));

    // Always fetch F2P items first (blocking - needed immediately)
    const f2pItems = await this.dataFetcher.getAllItems(false);
    console.log(chalk.green(`✓ Found ${f2pItems.length} F2P items`));

    // Start fetching members items in background (non-blocking)
    // This allows instant toggling from F2P to Members mode
    const membersItemsPromise = this.dataFetcher
      .getAllItems(true)
      .catch((err) => {
        // Silently handle errors - background fetch failure shouldn't block
        return null; // Return null on error to indicate failure
      });

    // Use appropriate items based on current setting
    const includeMembersItems = this.config.data.includeMembersItems || false;
    let allItems = f2pItems;
    let itemType = "F2P items";

    if (includeMembersItems) {
      // Members mode: Try cached first, otherwise wait for background fetch
      const cachedMembers = this.dataFetcher.cache?.get("all_items_members");
      if (
        cachedMembers &&
        Date.now() - cachedMembers.timestamp < this.dataFetcher.cacheTimeout
      ) {
        // Members items already cached, use them
        allItems = cachedMembers.data;
        itemType = "items (F2P + Members)";
        console.log(
          chalk.green(
            `✓ Using cached members items (${allItems.length} total)\n`
          )
        );
      } else {
        // Wait for background fetch to complete
        console.log(chalk.cyan("  Loading members items..."));
        const membersItems = await membersItemsPromise;
        if (membersItems && membersItems.length > 0) {
          allItems = membersItems;
          itemType = "items (F2P + Members)";
          console.log(chalk.green(`✓ Found ${allItems.length} ${itemType}\n`));
        } else {
          // Fallback to F2P if members fetch failed
          console.log(
            chalk.yellow(`⚠️  Members items not available, using F2P only\n`)
          );
        }
      }
    } else {
      // F2P mode - don't wait for members, just start background fetch
      console.log(chalk.green(`✓ Using ${allItems.length} ${itemType}\n`));
      // Start background fetch but don't await - let it run silently
      membersItemsPromise
        .then((membersItems) => {
          if (membersItems && membersItems.length > 0) {
            // Silently cache members items for future use
          }
        })
        .catch(() => {
          // Ignore errors - background fetch
        });
    }

    // Filter to high-volume items that can trade within the duration
    // Calculate minimum volume needed based on trade duration and profit targets
    const baseCapital = this.config.trading.baseCapital;
    const positionSize = baseCapital * this.config.trading.positionSizePercent;
    const minProfitPerTrade = this.config.trading.minProfitPerTradeGP;

    // Estimate minimum quantity needed for profit target
    // Assuming ~10% profit margin, we need quantity * price * 0.1 >= minProfit
    // For a 100 gp item with 10% margin: need ~50k quantity for 500k profit
    // Volume needs to support buying + selling: quantity * 2
    // For 1-day trade: need daily volume >= quantity * 2
    // For 3-day trade: need 3-day volume >= quantity * 2
    // Conservative estimate: require at least 5000 daily volume for quick trades
    const minDailyVolume = 5000; // Minimum daily volume for viable trades

    console.log(
      chalk.blue(
        `🔍 Filtering for high-volume items (min: ${minDailyVolume.toLocaleString()}/day)...`
      )
    );
    const items = await this.dataFetcher.filterByVolume(
      allItems,
      minDailyVolume,
      7, // Check last 7 days for volume
      this.config.data.volumeFilterCacheHours || 24 // Cache timeout from settings (default: 24 hours)
    );
    console.log(
      chalk.green(
        `✓ Found ${items.length} high-volume items suitable for ${this.config.trading.maxTradeDurationDays}-day trades\n`
      )
    );

    // Analyze with different durations (1, 3, 5 days)
    // Optimize: Fetch data once, then generate signals for each duration
    const allRecommendations = [];
    const durations = [1, 3, 5];
    const originalDuration = this.config.trading.maxTradeDurationDays;

    // Print analyzing message once before all analyses
    console.log(chalk.blue("📈 Analyzing market for multiple durations...\n"));

    // Step 1: Fetch all historical data once (this is the expensive part)
    // Check cache first, then fetch missing items in parallel batches with incremental saves
    await this.dataFetcher.ensureCacheLoaded();

    console.log(
      chalk.cyan("  Loading market data (using cache where available)...")
    );

    // Check if we have cached market data
    const marketDataCacheKey = `market_data_${items.length}_${items
      .slice(0, 3)
      .join("_")}`;
    const cachedMarketData = this.dataFetcher.cache?.get(marketDataCacheKey);
    const cacheTimeout = 60 * 60 * 1000; // 1 hour cache for market data
    let itemData = new Map();
    let itemsToFetch = items;

    // Check cache and resume from where we left off
    if (cachedMarketData) {
      const cachedData = cachedMarketData.data || {};
      const cachedItems = Object.keys(cachedData);

      // Load cached items
      cachedItems.forEach((item) => {
        if (items.includes(item) && cachedData[item]) {
          itemData.set(item, cachedData[item]);
        }
      });

      // Check which items we still need to fetch
      itemsToFetch = items.filter((item) => !cachedData[item]);

      if (itemsToFetch.length < items.length) {
        const cacheAge = Math.floor(
          (Date.now() - cachedMarketData.timestamp) / 1000 / 60
        );
        if (Date.now() - cachedMarketData.timestamp < cacheTimeout) {
          console.log(
            chalk.gray(
              `  Using cached data for ${itemData.size} items (cached ${cacheAge} min ago), fetching ${itemsToFetch.length} remaining items...`
            )
          );
        } else {
          console.log(
            chalk.gray(
              `  Resuming from cache: ${itemData.size} items already fetched (cache age: ${cacheAge} min), fetching ${itemsToFetch.length} remaining items...`
            )
          );
        }
      }
    }

    // Fetch missing items in parallel batches with incremental caching
    if (itemsToFetch.length > 0) {
      const totalItems = items.length;
      let fetched = itemData.size;
      const batchSize = 50; // Process 50 items in parallel

      const updateFetchProgress = (current, total) => {
        if (total === 0) return;
        const percentage = Math.floor((current / total) * 100);
        const barLength = 30;
        const filled = Math.floor((current / total) * barLength);
        const empty = barLength - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);
        process.stdout.write(
          `\r${chalk.blue("Fetching:")} [${chalk.green(bar)}] ${chalk.cyan(
            percentage + "%"
          )} ${chalk.gray(`(${current}/${total})`)}`
        );
      };

      // Process items in parallel batches
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);

        const batchPromises = batch.map(async (item) => {
          try {
            // Fetch both in parallel for each item
            const [historicalData, currentPrice] = await Promise.all([
              this.dataFetcher.fetchHistoricalData(item, 30),
              this.dataFetcher.getCurrentPrice(item),
            ]);

            if (
              currentPrice &&
              currentPrice > 0 &&
              historicalData &&
              historicalData.length > 0
            ) {
              return { item, historicalData, currentPrice };
            }
            return null;
          } catch (error) {
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Add successful results to itemData
        batchResults.forEach((result) => {
          if (result) {
            itemData.set(result.item, {
              historicalData: result.historicalData,
              currentPrice: result.currentPrice,
            });
          }
          fetched++;
          updateFetchProgress(fetched, totalItems);
        });

        // Save cache incrementally after each batch
        const marketDataObj = {};
        itemData.forEach((data, item) => {
          marketDataObj[item] = data;
        });

        this.dataFetcher.cache.set(marketDataCacheKey, {
          data: marketDataObj,
          timestamp: Date.now(),
        });

        // Save to disk every 100 items or at the end (non-blocking)
        const shouldSaveCache = fetched % 100 === 0 || fetched === totalItems;
        if (shouldSaveCache) {
          this.dataFetcher.saveCacheToDisk().catch(() => {
            // Ignore errors - cache writes are best-effort
          });
        }
      }

      process.stdout.write("\n");
    } else {
      process.stdout.write("\n");
    }

    console.log(chalk.green(`✓ Loaded data for ${itemData.size} items\n`));

    // Step 2: Analyze each item and determine optimal duration
    // For each item, try all durations and pick the best one based on:
    // - Profit potential
    // - Volume feasibility
    // - Confidence
    console.log(chalk.cyan("  Determining optimal durations for each item..."));
    const recommendations = [];
    let processed = 0;

    const updateSignalProgress = (current, total) => {
      if (total === 0) return;
      const percentage = Math.floor((current / total) * 100);
      const barLength = 30;
      const filled = Math.floor((current / total) * barLength);
      const empty = barLength - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      process.stdout.write(
        `\r${chalk.blue("Analyzing:")} [${chalk.green(bar)}] ${chalk.cyan(
          percentage + "%"
        )} ${chalk.gray(`(${current}/${total})`)}`
      );
    };

    for (const [item, data] of itemData.entries()) {
      try {
        const itemRecommendations = [];
        const originalDuration = this.config.trading.maxTradeDurationDays;

        // Try each duration and collect viable recommendations
        for (const duration of durations) {
          this.config.trading.maxTradeDurationDays = duration;

          const signal = this.signalGenerator.generateSignal(
            item,
            data.historicalData,
            data.currentPrice
          );

          if (
            signal.action === "BUY" &&
            signal.confidence >= this.minConfidence
          ) {
            // Check position constraints
            if (this.positionManager.getAvailableSlots() === 0) {
              continue; // Skip if no slots
            }
            if (this.positionManager.hasPosition(item)) {
              continue; // Skip if already holding
            }

            // Check if trade is viable for this duration
            // Require closer to minimum profit - only allow lower if very high confidence
            const minProfit = this.config.trading.minProfitPerTrade;
            // More lenient for quick trades: 30% for 1-2 day, 50% for 3-4 day, 80% for 5+ day
            const baseTolerance =
              duration <= 2 ? 0.3 : duration <= 4 ? 0.5 : 0.8;
            const minProfitThreshold = minProfit * baseTolerance;

            // Check volume feasibility - prefer safer trades (< 80% usage)
            // Allow up to 100% but penalize high usage
            let isVolumeFeasible = true;
            let volumeFeasibilityPercent = 100;
            if (signal.quantity && signal.avgDailyVolume && duration) {
              const requiredVolume = signal.quantity * 2; // Buy + sell
              const volumeUsagePercent =
                duration >= 5 ? 0.95 : duration >= 3 ? 0.9 : 0.75;
              const availableVolume =
                signal.avgDailyVolume * duration * volumeUsagePercent;
              volumeFeasibilityPercent =
                availableVolume > 0
                  ? (requiredVolume / availableVolume) * 100
                  : Infinity;
              // Only show truly feasible trades (<= 100% of available volume)
              // But prefer trades using < 95% for safety
              isVolumeFeasible = volumeFeasibilityPercent <= 100;

              // Reduce confidence for high volume usage (> 80%)
              if (isVolumeFeasible && volumeFeasibilityPercent > 80) {
                const highUsagePenalty =
                  ((volumeFeasibilityPercent - 80) / 20) * 0.15; // Up to 15% penalty
                signal.confidence = Math.max(
                  0.1,
                  signal.confidence * (1.0 - highUsagePenalty)
                );
              }
            }

            // Stricter inclusion criteria - require BOTH profit AND feasibility:
            // 1. Must meet profit threshold (or be very close with high confidence), AND
            // 2. Must be volume feasible (<= 100%)
            // 3. If profit is lower, require higher confidence (80%+)
            const meetsProfitThreshold =
              signal.netProfit && signal.netProfit >= minProfitThreshold;
            const isCloseToProfitThreshold =
              signal.netProfit &&
              signal.netProfit >= minProfitThreshold * 0.8 && // Within 80% of threshold
              signal.confidence >= 0.8; // But requires 80%+ confidence
            const hasVeryHighConfidence =
              signal.confidence && signal.confidence >= 0.85;

            // Calculate profit percentage for this signal
            const signalTotalCost =
              signal.entryPrice && signal.quantity
                ? signal.entryPrice * signal.quantity * 1.02 // Entry price + 2% fee
                : 0;
            const signalProfitPercent =
              signalTotalCost > 0
                ? (signal.netProfit / signalTotalCost) * 100
                : 0;
            // minProfitPercent is stored as decimal (0.01 = 1%), so multiply by 100 to get percentage
            const minProfitPercent =
              this.config.trading.minProfitPercent || 0.01;
            const meetsMinProfitPercent =
              signalProfitPercent >= minProfitPercent * 100;

            // Allow lower profit percentage (0.8%+) for high-profit, quick trades:
            // - Must make 150k+ profit (worth it even at lower %)
            // - Must be quick trade (1-3 days)
            // - Must have high confidence (85%+)
            const isHighProfitQuickTrade =
              signal.netProfit >= 150000 && // 150k+ profit
              duration <= 3 && // Quick trade (1-3 days)
              signal.confidence >= 0.85 && // High confidence
              signalProfitPercent >= 0.8; // At least 0.8% profit margin

            // Allow slightly lower profit percentage if confidence is very high (90%+)
            // But still require at least 0.9% (90% of 1%) to avoid very low profit trades
            const meetsMinProfitPercentWithHighConfidence =
              signal.confidence >= 0.9 &&
              signalProfitPercent >= minProfitPercent * 100 * 0.9; // 90% of minimum (0.9% instead of 1%)

            // Must be volume feasible AND (meet profit OR close with high confidence OR very high confidence with decent profit)
            // AND must meet minimum profit percentage (or be high-profit quick trade)
            // High-profit quick trades can bypass profit threshold if they have good profit %
            // Also allow trades with high profit % (3%+) to bypass threshold
            const bypassesThreshold =
              isHighProfitQuickTrade || signalProfitPercent >= 3.0;

            const isViable =
              isVolumeFeasible &&
              (meetsMinProfitPercent ||
                meetsMinProfitPercentWithHighConfidence ||
                isHighProfitQuickTrade) &&
              (bypassesThreshold ||
                meetsProfitThreshold ||
                isCloseToProfitThreshold ||
                (hasVeryHighConfidence &&
                  signal.netProfit &&
                  signal.netProfit >= minProfitThreshold * 0.5)); // At least 50% of threshold with 85%+ confidence

            if (isViable) {
              itemRecommendations.push({
                ...signal,
                currentPrice: data.currentPrice,
                duration: duration,
                historicalData: data.historicalData, // Include for market cap/volume analysis
              });
            }
          }
        }

        // Restore original duration
        this.config.trading.maxTradeDurationDays = originalDuration;

        // Select the best duration for this item
        if (itemRecommendations.length > 0) {
          // Score each recommendation: prioritize profit per month, then confidence
          itemRecommendations.forEach((rec) => {
            // Use executionPlan.totalDays if available, otherwise rec.duration or default
            const duration = rec.executionPlan?.totalDays || rec.duration || 1;
            rec.duration = duration; // Store for consistency
            rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
            rec.score =
              rec.profitPerMonth * 0.7 + (rec.confidence || 0) * 1000000 * 0.3;
          });

          // Sort by score (highest first)
          itemRecommendations.sort((a, b) => b.score - a.score);

          // Take only the best one per item to avoid duplicates
          const best = itemRecommendations[0];
          recommendations.push(best);
        }
      } catch (error) {
        // Skip errors
      } finally {
        processed++;
        if (processed % 50 === 0 || processed === itemData.size) {
          updateSignalProgress(processed, itemData.size);
        }
      }
    }
    process.stdout.write("\n");

    // Deduplicate recommendations: remove exact duplicates (same item, same duration, same prices)
    const seen = new Set();
    const uniqueRecommendations = [];
    for (const rec of recommendations) {
      // Create a unique key based on item name, duration, entry price, and exit price
      const itemName = rec.item || rec.name || "";
      const duration = rec.duration || rec.executionPlan?.totalDays || "";
      const entryPrice = rec.entryPrice || 0;
      const exitPrice = rec.exitPrice || rec.targetExitPrice || 0;
      const key = `${itemName}_${duration}_${entryPrice}_${exitPrice}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRecommendations.push(rec);
      }
    }

    allRecommendations.push(...uniqueRecommendations);

    // Restore original duration
    this.config.trading.maxTradeDurationDays = originalDuration;

    // Apply percentile filter to allRecommendations (same logic as analyzeMarket)
    const buyRecs = allRecommendations.filter((r) => r.action === "BUY");
    const nonBuyRecs = allRecommendations.filter((r) => r.action !== "BUY");

    let filteredRecommendations = allRecommendations;
    if (buyRecs.length > 0) {
      // Calculate percentile threshold (default: top 20%)
      const percentileThreshold =
        this.config.trading.profitPerMonthPercentile || 0.2;

      // Sort by profit per month (descending) to get top recommendations
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many recommendations to keep (top percentile)
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take the top N recommendations (percentile-based, no absolute minimum)
      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      console.log(
        chalk.gray(
          `   Filtered ${buyRecs.length} BUY recommendations to top ${
            percentileThreshold * 100
          }% (${topPercentileRecs.length} recommendations)\n`
        )
      );

      // Combine top percentile BUY recs with non-BUY recs
      filteredRecommendations = [...topPercentileRecs, ...nonBuyRecs];
    }

    console.log(
      chalk.green(
        `\n✓ Analysis complete! Found ${filteredRecommendations.length} recommendations (after percentile filter)\n`
      )
    );

    // Convert recommendations to format for TradeManager
    // Keep all original data, just ensure benefits is an array and action is lowercase
    let formattedRecs = filteredRecommendations
      .filter((rec) => rec.action === "BUY") // Only show BUY recommendations
      .map((rec) => ({
        ...rec, // Keep all original fields
        action: rec.action.toLowerCase(), // Ensure lowercase
        price: rec.entryPrice || rec.currentPrice || rec.price || 0, // Ensure price field exists
        benefits: Array.isArray(rec.benefits)
          ? rec.benefits
          : rec.benefits
          ? [rec.benefits]
          : [], // Ensure benefits is an array
      }));

    // Show recommendations (skip interactive prompt for non-interactive mode)
    const skipInteractive =
      process.env.SKIP_INTERACTIVE === "true" ||
      process.argv.includes("--no-interactive");

    // Loop to handle settings refresh
    let needsRefresh = false;
    do {
      // Re-fetch items and re-analyze if refresh is needed
      if (needsRefresh) {
        console.log(
          chalk.blue("\n🔄 Refreshing recommendations with new settings...\n")
        );

        // Use cached items - no need to fetch again
        // F2P items are already loaded, members items should be cached from background fetch
        const includeMembersItems =
          this.config.data.includeMembersItems || false;

        let newAllItems;
        let newItemType;

        if (includeMembersItems) {
          // Members mode: use cached members items (includes F2P)
          const cachedMembers =
            this.dataFetcher.cache?.get("all_items_members");
          if (
            cachedMembers &&
            Date.now() - cachedMembers.timestamp < this.dataFetcher.cacheTimeout
          ) {
            newAllItems = cachedMembers.data;
            newItemType = "items (F2P + Members)";
          } else {
            // Members items not ready yet - fetch now (should be fast if background fetch completed)
            newAllItems = await this.dataFetcher.getAllItems(true);
            newItemType = "items (F2P + Members)";
          }
        } else {
          // F2P mode: use cached F2P items (already loaded)
          const cachedF2P = this.dataFetcher.cache?.get("all_items_f2p");
          if (cachedF2P) {
            newAllItems = cachedF2P.data;
            newItemType = "F2P items";
          } else {
            // Fallback: fetch F2P (shouldn't happen, but just in case)
            newAllItems = await this.dataFetcher.getAllItems(false);
            newItemType = "F2P items";
          }
        }

        console.log(
          chalk.green(`✓ Using ${newAllItems.length} ${newItemType}\n`)
        );

        // Re-filter by volume
        const minDailyVolume = 5000;
        console.log(
          chalk.blue(
            `🔍 Filtering for high-volume items (min: ${minDailyVolume.toLocaleString()}/day)...`
          )
        );
        const newItems = await this.dataFetcher.filterByVolume(
          newAllItems,
          minDailyVolume,
          7,
          this.config.data.volumeFilterCacheHours
        );
        console.log(
          chalk.green(`✓ Found ${newItems.length} high-volume items\n`)
        );

        // Re-analyze market
        const newRecommendations = await this.analyzeMarket(newItems, true);

        // Re-format recommendations
        formattedRecs = newRecommendations
          .filter((rec) => rec.action === "BUY")
          .map((rec) => ({
            ...rec,
            action: rec.action.toLowerCase(),
            price: rec.entryPrice || rec.currentPrice || rec.price || 0,
            benefits: Array.isArray(rec.benefits)
              ? rec.benefits
              : rec.benefits
              ? [rec.benefits]
              : [],
          }));
      }

      const result = await this.tradeManager.promptForApproval(
        formattedRecs,
        skipInteractive,
        this.settings
      );

      // Check if refresh is needed
      needsRefresh = result && result.needsRefresh === true;
    } while (needsRefresh);

    // Also display current trades after approval
    this.tradeManager.displayTrades();

    // Close readline when done
    this.tradeManager.close();
  }

  /**
   * Analyze market and generate trading recommendations
   * @param {Array<string>} items - List of items to analyze
   * @param {boolean} skipMessage - If true, skip the "Analyzing market..." message
   * @returns {Promise<Array>} Array of recommendations
   */
  async analyzeMarket(items, skipMessage = false) {
    if (!skipMessage) {
      console.log(chalk.blue("📈 Analyzing market...\n"));
    }

    const recommendations = [];
    const totalItems = items.length;
    let processed = 0;

    // Helper function to update progress bar
    const updateProgress = (current, total) => {
      if (total === 0) return;
      const percentage = Math.floor((current / total) * 100);
      const barLength = 30;
      const filled = Math.floor((current / total) * barLength);
      const empty = barLength - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      process.stdout.write(
        `\r${chalk.blue("Progress:")} [${chalk.green(bar)}] ${chalk.cyan(
          percentage + "%"
        )} ${chalk.gray(`(${current}/${total})`)}`
      );
    };

    for (const item of items) {
      try {
        // Fetch historical data
        const historicalData = await this.dataFetcher.fetchHistoricalData(
          item,
          30
        );
        const currentPrice = await this.dataFetcher.getCurrentPrice(item);

        // Generate signal
        const signal = this.signalGenerator.generateSignal(
          item,
          historicalData,
          currentPrice
        );

        // Always include signals, but mark low confidence ones
        if (
          signal.confidence >= this.minConfidence ||
          signal.action !== "HOLD"
        ) {
          // Check if we can add more positions
          if (
            signal.action === "BUY" &&
            this.positionManager.getAvailableSlots() === 0
          ) {
            signal.action = "HOLD";
            signal.reason = "No available slots (F2P limit)";
            // Update explanation to match HOLD action - remove BUY recommendations
            if (signal.explanation) {
              // Remove "X of Y strategies recommend BUY" pattern
              signal.explanation = signal.explanation
                .replace(
                  /\d+\s+of\s+\d+\s+strategies?\s+recommend\s+BUY[.\s]*/i,
                  ""
                )
                .trim();
              // Prepend HOLD reason if explanation is empty or doesn't start with HOLD
              if (!signal.explanation.startsWith("HOLD:")) {
                signal.explanation =
                  `HOLD: ${signal.reason}. ${signal.explanation}`.trim();
              }
            }
          }

          // Check if we already have this position
          if (
            signal.action === "BUY" &&
            this.positionManager.hasPosition(item)
          ) {
            signal.action = "HOLD";
            signal.reason = "Already holding position";
            // Update explanation to match HOLD action - remove BUY recommendations
            if (signal.explanation) {
              // Remove "X of Y strategies recommend BUY" pattern
              signal.explanation = signal.explanation
                .replace(
                  /\d+\s+of\s+\d+\s+strategies?\s+recommend\s+BUY[.\s]*/i,
                  ""
                )
                .trim();
              // Prepend HOLD reason if explanation is empty or doesn't start with HOLD
              if (!signal.explanation.startsWith("HOLD:")) {
                signal.explanation =
                  `HOLD: ${signal.reason}. ${signal.explanation}`.trim();
              }
            }
          }

          // Include all signals for now - we'll filter later
          recommendations.push({
            ...signal,
            currentPrice,
          });
        } else if (signal.action === "HOLD" && signal.confidence >= 0.4) {
          // Include HOLD signals with decent confidence for information
          recommendations.push({
            ...signal,
            currentPrice,
          });
        }
      } catch (error) {
        console.error(chalk.red(`Error analyzing ${item}:`), error.message);
      } finally {
        processed++;
        updateProgress(processed, totalItems);
      }
    }

    // Clear progress bar and move to new line
    process.stdout.write("\n");

    // Sort by action priority (BUY > SELL > HOLD), then by confidence (highest first)
    recommendations.sort((a, b) => {
      const actionPriority = { BUY: 3, SELL: 2, HOLD: 1 };
      if (actionPriority[b.action] !== actionPriority[a.action]) {
        return actionPriority[b.action] - actionPriority[a.action];
      }
      return b.confidence - a.confidence;
    });

    // Filter to only show viable trades (profitable AND feasible)
    const minProfit = this.config.trading.minProfitPerTrade;
    let viableRecommendations = recommendations.filter((rec) => {
      if (rec.action === "BUY") {
        // Stricter: require closer to minimum profit AND volume feasibility
        // More lenient for quick trades: 30% for 1-2 day, 50% for 3-4 day, 80% for 5+ day
        // Or 80%+ confidence with 50% of minimum
        const duration =
          rec.duration || this.config.trading.maxTradeDurationDays;
        const baseTolerance = duration <= 2 ? 0.3 : duration <= 4 ? 0.5 : 0.8;
        const minProfitThreshold = minProfit * baseTolerance;

        if (rec.netProfit !== undefined) {
          // Check volume feasibility - be stricter, don't allow 100% usage
          let isVolumeFeasible = true;
          if (rec.quantity && rec.avgDailyVolume && duration) {
            const requiredVolume = rec.quantity * 2;
            const volumeUsagePercent =
              duration >= 5 ? 0.95 : duration >= 3 ? 0.9 : 0.75;
            const availableVolume =
              rec.avgDailyVolume * duration * volumeUsagePercent;
            const feasibilityPercent =
              availableVolume > 0
                ? (requiredVolume / availableVolume) * 100
                : Infinity;
            // Don't allow trades using > 100% of available volume
            // But prefer trades using < 95% for safety
            isVolumeFeasible = feasibilityPercent <= 100;
          }

          // Calculate profit percentage (net profit / total cost)
          const totalCost =
            rec.entryPrice && rec.quantity
              ? rec.entryPrice * rec.quantity * 1.02 // Entry price + 2% fee
              : 0;
          const profitPercent =
            totalCost > 0 ? (rec.netProfit / totalCost) * 100 : 0;

          // Must meet minimum profit percentage (e.g., 1%)
          // minProfitPercent is stored as decimal (0.01 = 1%), so multiply by 100 to get percentage
          const minProfitPercent = this.config.trading.minProfitPercent || 0.01;
          const meetsMinProfitPercent = profitPercent >= minProfitPercent * 100;

          // Allow lower profit percentage (0.8%+) for high-profit, quick trades:
          // - Must make 150k+ profit (worth it even at lower %)
          // - Must be quick trade (1-3 days)
          // - Must have high confidence (85%+)
          const isHighProfitQuickTrade =
            rec.netProfit >= 150000 && // 150k+ profit
            duration <= 3 && // Quick trade (1-3 days)
            rec.confidence >= 0.85 && // High confidence
            profitPercent >= 0.8; // At least 0.8% profit margin

          // Allow slightly lower profit percentage if confidence is very high (90%+)
          // But still require at least 0.9% (90% of 1%) to avoid very low profit trades
          const meetsMinProfitPercentWithHighConfidence =
            rec.confidence >= 0.9 &&
            profitPercent >= minProfitPercent * 100 * 0.9; // 90% of minimum (0.9% instead of 1%)

          // Must be profitable AND volume feasible AND meet threshold (or high confidence)
          const meetsThreshold = rec.netProfit >= minProfitThreshold;
          const isCloseWithHighConfidence =
            rec.netProfit >= minProfitThreshold * 0.5 && rec.confidence >= 0.8;

          // High-profit quick trades can bypass profit threshold if they have good profit %
          // Also allow trades with high profit % (3%+) to bypass threshold (good ROI even if absolute profit is lower)
          const bypassesThreshold =
            isHighProfitQuickTrade || profitPercent >= 3.0;

          return (
            rec.netProfit > 0 &&
            isVolumeFeasible &&
            (meetsMinProfitPercent ||
              meetsMinProfitPercentWithHighConfidence ||
              isHighProfitQuickTrade) && // Must meet minimum profit percentage, OR be high-profit quick trade
            (bypassesThreshold || meetsThreshold || isCloseWithHighConfidence) // High-profit quick trades bypass threshold
          );
        }
        // If netProfit not calculated yet, require high confidence
        return rec.confidence >= 0.8;
      }
      // Include SELL and HOLD signals for information
      return true;
    });

    // Calculate profit per month for all BUY recommendations
    // Use the same duration calculation as display to ensure consistency
    viableRecommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        // Use executionPlan.totalDays if available, otherwise use rec.duration or maxTradeDurationDays
        // Store duration on rec so display uses the same value
        const duration =
          rec.executionPlan?.totalDays ||
          rec.duration ||
          rec.maxTradeDurationDays ||
          2;
        rec.duration = duration; // Store for display consistency
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Filter by top percentile of profit per month (only for BUY recommendations)
    const buyRecs = viableRecommendations.filter((r) => r.action === "BUY");
    const nonBuyRecs = viableRecommendations.filter((r) => r.action !== "BUY");

    if (buyRecs.length > 0) {
      // Calculate percentile threshold (default: top 20%)
      const percentileThreshold =
        this.config.trading.profitPerMonthPercentile || 0.2;

      // Sort by profit per month (descending) to get top recommendations
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many recommendations to keep (top percentile)
      // Use Math.ceil to ensure we keep at least 1 if there are any recommendations
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take the top N recommendations (percentile-based, no absolute minimum)
      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Combine top percentile BUY recs with non-BUY recs
      viableRecommendations = [...topPercentileRecs, ...nonBuyRecs];
    }

    // Sort by action priority (BUY > SELL > HOLD), then by net profit (highest first), then confidence
    viableRecommendations.sort((a, b) => {
      const actionPriority = { BUY: 3, SELL: 2, HOLD: 1 };
      if (actionPriority[b.action] !== actionPriority[a.action]) {
        return actionPriority[b.action] - actionPriority[a.action];
      }

      // For BUY signals, prioritize by profit percentage first, then absolute profit, then confidence
      if (a.action === "BUY" && b.action === "BUY") {
        // Calculate profit percentages
        const aTotalCost = (a.entryPrice || 0) * (a.quantity || 0) * 1.02;
        const bTotalCost = (b.entryPrice || 0) * (b.quantity || 0) * 1.02;
        const aProfitPercent =
          aTotalCost > 0 ? ((a.netProfit || 0) / aTotalCost) * 100 : 0;
        const bProfitPercent =
          bTotalCost > 0 ? ((b.netProfit || 0) / bTotalCost) * 100 : 0;

        // Sort by profit percentage first (higher is better)
        if (Math.abs(aProfitPercent - bProfitPercent) > 0.1) {
          return bProfitPercent - aProfitPercent;
        }

        // If profit percentages are similar, sort by absolute profit
        const aProfit = a.netProfit || 0;
        const bProfit = b.netProfit || 0;
        if (Math.abs(aProfit - bProfit) > 1000) {
          return bProfit - aProfit;
        }
      }

      return b.confidence - a.confidence;
    });

    // Limit to available slots for BUY recommendations
    const buyRecommendations = viableRecommendations.filter(
      (r) => r.action === "BUY"
    );
    const availableSlots = this.positionManager.getAvailableSlots();

    let finalRecommendations = viableRecommendations;
    if (buyRecommendations.length > availableSlots) {
      // Keep only top recommendations by profit
      const topBuys = buyRecommendations.slice(0, availableSlots);
      const others = viableRecommendations.filter((r) => r.action !== "BUY");
      finalRecommendations = [...topBuys, ...others];
    }

    // Return the filtered recommendations (already limited by percentile)
    return finalRecommendations;
  }

  /**
   * Display trading recommendations
   * @private
   */
  displayRecommendations(recommendations) {
    if (recommendations.length === 0) {
      console.log(
        chalk.yellow("⚠️  No trading opportunities found at this time.\n")
      );
      return;
    }

    // Group by duration
    const byDuration = {
      1: recommendations.filter((r) => r.duration === 1 && r.action === "BUY"),
      3: recommendations.filter((r) => r.duration === 3 && r.action === "BUY"),
      5: recommendations.filter((r) => r.duration === 5 && r.action === "BUY"),
    };

    console.log(chalk.bold("\n📋 Trading Recommendations:\n"));

    // Calculate profit per month for all BUY recommendations
    const allBuyRecs = recommendations.filter(
      (r) => r.action === "BUY" && r.duration
    );
    allBuyRecs.forEach((rec) => {
      const duration = rec.duration || this.config.trading.maxTradeDurationDays;
      rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
    });

    // Find the highest profit per month across all recommendations
    const highestProfitPerMonth =
      allBuyRecs.length > 0
        ? Math.max(...allBuyRecs.map((r) => r.profitPerMonth || 0))
        : 0;

    // Award "Highest Profit Per Month" to only the highest
    allBuyRecs.forEach((rec) => {
      if (
        rec.profitPerMonth === highestProfitPerMonth &&
        highestProfitPerMonth > 0
      ) {
        rec.benefits =
          !rec.benefits ||
          rec.benefits === "" ||
          rec.benefits === "Standard Trade"
            ? "Highest Profit Per Month"
            : rec.benefits + ", Highest Profit Per Month";
      }
    });

    // Award "Highest Confidence" to highest confidence trade in each duration group
    [1, 3, 5].forEach((duration) => {
      const durationRecs = allBuyRecs.filter((r) => r.duration === duration);
      if (durationRecs.length > 0) {
        const highestConfidence = Math.max(
          ...durationRecs.map((r) => r.confidence || 0)
        );

        // Only award if confidence is >= 85%
        if (highestConfidence >= 0.85) {
          durationRecs.forEach((rec) => {
            if (rec.confidence === highestConfidence) {
              rec.benefits =
                !rec.benefits ||
                rec.benefits === "" ||
                rec.benefits === "Standard Trade"
                  ? "Highest Confidence"
                  : rec.benefits + ", Highest Confidence";
            }
          });
        }
      }
    });

    // Award percentile-based benefits (top 10% for most metrics)
    if (allBuyRecs.length > 0) {
      // Calculate percentiles for various metrics
      const volumes = allBuyRecs
        .map((r) => r.avgDailyVolume || 0)
        .filter((v) => v > 0)
        .sort((a, b) => b - a);
      const profits = allBuyRecs
        .map((r) => r.netProfit || 0)
        .filter((p) => p > 0)
        .sort((a, b) => b - a);
      const profitMargins = allBuyRecs
        .map((r) => {
          if (r.netProfit && r.quantity && r.entryPrice) {
            const profitPerUnit = r.netProfit / r.quantity;
            return (profitPerUnit / r.entryPrice) * 100;
          }
          return 0;
        })
        .filter((m) => m > 0)
        .sort((a, b) => b - a);

      // Top 10 percentile index (90th percentile)
      const top10Index = Math.max(0, Math.floor(allBuyRecs.length * 0.1));
      const top10VolumeThreshold = volumes.length > 0 ? volumes[top10Index] : 0;
      const top10ProfitThreshold = profits.length > 0 ? profits[top10Index] : 0;
      const top10MarginThreshold =
        profitMargins.length > 0 ? profitMargins[top10Index] : 0;

      // Award "High Volume" to top 10% by volume
      allBuyRecs.forEach((rec) => {
        if (rec.avgDailyVolume && rec.avgDailyVolume >= top10VolumeThreshold) {
          rec.benefits =
            !rec.benefits ||
            rec.benefits === "" ||
            rec.benefits === "Standard Trade"
              ? "High Volume"
              : rec.benefits + ", High Volume";
        }
      });

      // Award "Most Profitable" to top 10% by profit (if not already awarded)
      allBuyRecs.forEach((rec) => {
        if (
          rec.netProfit &&
          rec.netProfit >= top10ProfitThreshold &&
          (!rec.benefits || !rec.benefits.includes("Most Profitable"))
        ) {
          rec.benefits =
            !rec.benefits ||
            rec.benefits === "" ||
            rec.benefits === "Standard Trade"
              ? "Most Profitable"
              : rec.benefits + ", Most Profitable";
        }
      });

      // Award "Best Value" to top 10% by profit margin (if not already awarded)
      allBuyRecs.forEach((rec) => {
        if (rec.netProfit && rec.quantity && rec.entryPrice) {
          const profitPerUnit = rec.netProfit / rec.quantity;
          const profitMargin = (profitPerUnit / rec.entryPrice) * 100;
          if (
            profitMargin >= top10MarginThreshold &&
            (!rec.benefits || !rec.benefits.includes("Best Value"))
          ) {
            rec.benefits =
              !rec.benefits ||
              rec.benefits === "" ||
              rec.benefits === "Standard Trade"
                ? "Best Value"
                : rec.benefits + ", Best Value";
          }
        }
      });
    }

    // Display by duration
    [1, 3, 5].forEach((duration) => {
      const durationRecs = byDuration[duration];
      if (durationRecs.length > 0) {
        // Sort by net profit (highest first)
        durationRecs.sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));

        console.log(
          chalk.bold(
            `\n${
              duration === 1 ? "⚡" : duration === 3 ? "📅" : "📆"
            } ${duration}-Day Trades:`
          )
        );
        console.log(chalk.gray("─".repeat(80)));

        durationRecs.slice(0, 3).forEach((rec, index) => {
          this.displaySingleRecommendation(rec, index + 1);
        });
      }
    });

    // Show other recommendations (SELL, HOLD)
    const otherRecs = recommendations.filter(
      (r) => r.action !== "BUY" || !r.duration
    );
    if (otherRecs.length > 0) {
      console.log(chalk.bold("\n📊 Other Recommendations:"));
      console.log(chalk.gray("─".repeat(80)));
      otherRecs.forEach((rec, index) => {
        this.displaySingleRecommendation(rec, index + 1);
      });
    }

    // Calculate total monthly potential if running all 3 positions simultaneously
    const top3ByProfitPerMonth = allBuyRecs
      .sort((a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0))
      .slice(0, this.positionManager.maxPositions);

    if (top3ByProfitPerMonth.length > 0) {
      const totalMonthlyProfit = top3ByProfitPerMonth.reduce(
        (sum, rec) => sum + (rec.profitPerMonth || 0),
        0
      );
      const totalCapitalUsed = top3ByProfitPerMonth.reduce(
        (sum, rec) => sum + (rec.totalCost || 0),
        0
      );

      // Calculate average profit per trade and ROI
      const avgProfitPerTrade =
        top3ByProfitPerMonth.reduce(
          (sum, rec) => sum + (rec.netProfit || 0),
          0
        ) / top3ByProfitPerMonth.length;

      const avgROI =
        totalCapitalUsed > 0
          ? (avgProfitPerTrade /
              (totalCapitalUsed / top3ByProfitPerMonth.length)) *
            100
          : 0;

      console.log(chalk.gray("\n" + "─".repeat(80)));
      console.log(
        chalk.bold.green(
          `\n💰 Monthly Potential (${this.positionManager.maxPositions} positions running simultaneously):`
        )
      );
      console.log(
        `   Total Monthly Profit: ${chalk.green(
          formatGP(totalMonthlyProfit)
        )} gp`
      );
      console.log(
        `   Capital Used: ${chalk.yellow(formatGP(totalCapitalUsed))} GP (${(
          (totalCapitalUsed / this.config.trading.baseCapital) *
          100
        ).toFixed(1)}% of ${formatGP(this.config.trading.baseCapital)} GP)`
      );
      console.log(
        `   Average Profit Per Trade: ${chalk.cyan(
          formatGP(avgProfitPerTrade)
        )} gp`
      );
      console.log(
        `   Average ROI Per Trade: ${chalk.cyan(avgROI.toFixed(1))}%`
      );
    }

    console.log(chalk.gray("\n" + "─".repeat(80)));
    console.log(
      chalk.dim(
        `\n💡 Remember: F2P accounts can only hold ${this.positionManager.maxPositions} items at a time\n`
      )
    );
  }

  /**
   * Display a single recommendation
   * @private
   */
  displaySingleRecommendation(rec, index) {
    const actionColor =
      rec.action === "BUY"
        ? chalk.green
        : rec.action === "SELL"
        ? chalk.red
        : chalk.yellow;

    console.log(`\n${index}. ${chalk.bold(rec.item)}`);
    console.log(`   Action: ${actionColor.bold(rec.action)}`);
    console.log(
      `   Confidence: ${chalk.cyan((rec.confidence * 100).toFixed(1) + "%")}`
    );

    // Calculate and display duration and monthly profit for BUY trades
    if (rec.action === "BUY") {
      const duration = rec.duration || this.config.trading.maxTradeDurationDays;
      const netProfit =
        rec.netProfit || (rec.exitPrice - rec.entryPrice) * rec.quantity;

      // Calculate profit per month (assuming we repeat the trade)
      // 30 days / duration = trades per month
      const tradesPerMonth = 30 / duration;
      const profitPerMonth = netProfit * tradesPerMonth;

      console.log(
        `   Expected Duration: ${chalk.cyan(
          `≤ ${duration} days`
        )} | ${chalk.bold("Profit/Month:")} ${chalk.green(
          formatGP(Math.floor(profitPerMonth))
        )} gp`
      );
    }

    console.log(
      `   Current Price: ${chalk.white(
        formatGP(Math.floor(rec.currentPrice))
      )} GP`
    );

    if (rec.action === "BUY") {
      console.log(
        `   Entry Price: ${chalk.green(
          formatGP(Math.floor(rec.entryPrice))
        )} gp`
      );
      console.log(
        `   Target Exit: ${chalk.green(formatGP(Math.floor(rec.exitPrice)))} GP`
      );
      console.log(
        `   Stop Loss: ${chalk.red(formatGP(Math.floor(rec.stopLoss)))} GP`
      );
      console.log(
        `   Quantity: ${chalk.white(rec.quantity.toLocaleString())} units`
      );

      // Calculate costs and profits
      const totalCost = rec.totalCost || 0;
      console.log(
        `   ${chalk.bold("Total Cost:")} ${chalk.yellow(
          formatGP(totalCost)
        )} GP ${chalk.dim("(including GE fees)")}`
      );

      // Show net profit (after fees)
      const netProfit =
        rec.netProfit || (rec.exitPrice - rec.entryPrice) * rec.quantity;
      const grossProfit = (rec.exitPrice - rec.entryPrice) * rec.quantity;
      // Calculate profit margin as (netProfit / totalCost) * 100
      // This accounts for fees, unlike the simple per-unit price difference
      // Use existing totalCost variable from above
      const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      const profitColor =
        netProfit >= this.config.trading.targetProfitPerTrade
          ? chalk.green
          : netProfit >= this.config.trading.minProfitPerTrade
          ? chalk.yellow
          : chalk.red;

      console.log(
        `   ${chalk.bold("Net Profit:")} ${profitColor(
          formatGP(netProfit)
        )} GP ${chalk.dim(
          `(after ${rec.entryPrice > 50 ? "2%" : "0%"} GE fees)`
        )}`
      );

      if (grossProfit !== netProfit && rec.entryPrice > 50) {
        const fees = grossProfit - netProfit;
        console.log(`   ${chalk.dim(`Fees: ${formatGP(fees)} GP`)}`);
      }

      console.log(
        `   ${chalk.bold("Profit Margin:")} ${chalk.cyan(
          profitPercent.toFixed(2) + "%"
        )}`
      );

      // Show explanation and benefits
      if (rec.explanation) {
        console.log(`   ${chalk.bold("Why:")} ${chalk.white(rec.explanation)}`);
      }
      if (rec.benefits) {
        console.log(
          `   ${chalk.bold("Benefits:")} ${chalk.cyan(rec.benefits)}`
        );
      }

      // Don't show "Below minimum target" warning - if it's shown, it should meet our thresholds
      // The filtering should have already removed trades that don't meet minimums
    }

    if (rec.reason) {
      console.log(`   Note: ${chalk.yellow(rec.reason)}`);
    }
  }

  /**
   * Analyze market and generate trading recommendations
   * @param {Array<string>} items - List of items to analyze
   * @param {boolean} skipMessage - If true, skip the "Analyzing market..." message
   * @returns {Promise<Array>} Array of recommendations
   */
  async analyzeMarket(items, skipMessage = false) {
    if (!skipMessage) {
      console.log(chalk.blue("📈 Analyzing market...\n"));
    }

    const recommendations = [];
    const totalItems = items.length;
    let processed = 0;

    // Helper function to update progress bar
    const updateProgress = (current, total) => {
      if (total === 0) return;
      const percentage = Math.floor((current / total) * 100);
      const barLength = 30;
      const filled = Math.floor((current / total) * barLength);
      const empty = barLength - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      process.stdout.write(
        `\r${chalk.blue("Progress:")} [${chalk.green(bar)}] ${chalk.cyan(
          percentage + "%"
        )} ${chalk.gray(`(${current}/${total})`)}`
      );
    };

    for (const item of items) {
      try {
        // Fetch historical data
        const historicalData = await this.dataFetcher.fetchHistoricalData(
          item,
          30
        );
        const currentPrice = await this.dataFetcher.getCurrentPrice(item);

        // Generate signal
        const signal = this.signalGenerator.generateSignal(
          item,
          historicalData,
          currentPrice
        );

        // Always include signals, but mark low confidence ones
        if (
          signal.confidence >= this.minConfidence ||
          signal.action !== "HOLD"
        ) {
          // Check if we can add more positions
          if (
            signal.action === "BUY" &&
            this.positionManager.getAvailableSlots() === 0
          ) {
            signal.action = "HOLD";
            signal.reason = "No available slots (F2P limit)";
            // Update explanation to match HOLD action - remove BUY recommendations
            if (signal.explanation) {
              // Remove "X of Y strategies recommend BUY" pattern
              signal.explanation = signal.explanation
                .replace(
                  /\d+\s+of\s+\d+\s+strategies?\s+recommend\s+BUY[.\s]*/i,
                  ""
                )
                .trim();
              // Prepend HOLD reason if explanation is empty or doesn't start with HOLD
              if (!signal.explanation.startsWith("HOLD:")) {
                signal.explanation =
                  `HOLD: ${signal.reason}. ${signal.explanation}`.trim();
              }
            }
          }

          // Check if we already have this position
          if (
            signal.action === "BUY" &&
            this.positionManager.hasPosition(item)
          ) {
            signal.action = "HOLD";
            signal.reason = "Already holding position";
            // Update explanation to match HOLD action - remove BUY recommendations
            if (signal.explanation) {
              // Remove "X of Y strategies recommend BUY" pattern
              signal.explanation = signal.explanation
                .replace(
                  /\d+\s+of\s+\d+\s+strategies?\s+recommend\s+BUY[.\s]*/i,
                  ""
                )
                .trim();
              // Prepend HOLD reason if explanation is empty or doesn't start with HOLD
              if (!signal.explanation.startsWith("HOLD:")) {
                signal.explanation =
                  `HOLD: ${signal.reason}. ${signal.explanation}`.trim();
              }
            }
          }

          // Include all signals for now - we'll filter later
          recommendations.push({
            ...signal,
            currentPrice,
          });
        } else if (signal.action === "HOLD" && signal.confidence >= 0.4) {
          // Include HOLD signals with decent confidence for information
          recommendations.push({
            ...signal,
            currentPrice,
          });
        }
      } catch (error) {
        console.error(chalk.red(`Error analyzing ${item}:`), error.message);
      } finally {
        processed++;
        updateProgress(processed, totalItems);
      }
    }

    // Clear progress bar and move to new line
    process.stdout.write("\n");

    // Sort by action priority (BUY > SELL > HOLD), then by confidence (highest first)
    recommendations.sort((a, b) => {
      const actionPriority = { BUY: 3, SELL: 2, HOLD: 1 };
      if (actionPriority[b.action] !== actionPriority[a.action]) {
        return actionPriority[b.action] - actionPriority[a.action];
      }
      return b.confidence - a.confidence;
    });

    // Filter to only show viable trades (profitable AND feasible)
    const minProfit = this.config.trading.minProfitPerTrade;
    let viableRecommendations = recommendations.filter((rec) => {
      if (rec.action === "BUY") {
        // Stricter: require closer to minimum profit AND volume feasibility
        // More lenient for quick trades: 30% for 1-2 day, 50% for 3-4 day, 80% for 5+ day
        // Or 80%+ confidence with 50% of minimum
        const duration =
          rec.duration || this.config.trading.maxTradeDurationDays;
        const baseTolerance = duration <= 2 ? 0.3 : duration <= 4 ? 0.5 : 0.8;
        const minProfitThreshold = minProfit * baseTolerance;

        if (rec.netProfit !== undefined) {
          // Check volume feasibility - be stricter, don't allow 100% usage
          let isVolumeFeasible = true;
          if (rec.quantity && rec.avgDailyVolume && duration) {
            const requiredVolume = rec.quantity * 2;
            const volumeUsagePercent =
              duration >= 5 ? 0.95 : duration >= 3 ? 0.9 : 0.75;
            const availableVolume =
              rec.avgDailyVolume * duration * volumeUsagePercent;
            const feasibilityPercent =
              availableVolume > 0
                ? (requiredVolume / availableVolume) * 100
                : Infinity;
            // Don't allow trades using > 100% of available volume
            // But prefer trades using < 95% for safety
            isVolumeFeasible = feasibilityPercent <= 100;
          }

          // Calculate profit percentage (net profit / total cost)
          const totalCost =
            rec.entryPrice && rec.quantity
              ? rec.entryPrice * rec.quantity * 1.02 // Entry price + 2% fee
              : 0;
          const profitPercent =
            totalCost > 0 ? (rec.netProfit / totalCost) * 100 : 0;

          // Must meet minimum profit percentage (e.g., 1%)
          // minProfitPercent is stored as decimal (0.01 = 1%), so multiply by 100 to get percentage
          const minProfitPercent = this.config.trading.minProfitPercent || 0.01;
          const meetsMinProfitPercent = profitPercent >= minProfitPercent * 100;

          // Allow lower profit percentage (0.8%+) for high-profit, quick trades:
          // - Must make 150k+ profit (worth it even at lower %)
          // - Must be quick trade (1-3 days)
          // - Must have high confidence (85%+)
          const isHighProfitQuickTrade =
            rec.netProfit >= 150000 && // 150k+ profit
            duration <= 3 && // Quick trade (1-3 days)
            rec.confidence >= 0.85 && // High confidence
            profitPercent >= 0.8; // At least 0.8% profit margin

          // Allow slightly lower profit percentage if confidence is very high (90%+)
          // But still require at least 0.9% (90% of 1%) to avoid very low profit trades
          const meetsMinProfitPercentWithHighConfidence =
            rec.confidence >= 0.9 &&
            profitPercent >= minProfitPercent * 100 * 0.9; // 90% of minimum (0.9% instead of 1%)

          // Must be profitable AND volume feasible AND meet threshold (or high confidence)
          const meetsThreshold = rec.netProfit >= minProfitThreshold;
          const isCloseWithHighConfidence =
            rec.netProfit >= minProfitThreshold * 0.5 && rec.confidence >= 0.8;

          // High-profit quick trades can bypass profit threshold if they have good profit %
          // Also allow trades with high profit % (3%+) to bypass threshold (good ROI even if absolute profit is lower)
          const bypassesThreshold =
            isHighProfitQuickTrade || profitPercent >= 3.0;

          return (
            rec.netProfit > 0 &&
            isVolumeFeasible &&
            (meetsMinProfitPercent ||
              meetsMinProfitPercentWithHighConfidence ||
              isHighProfitQuickTrade) && // Must meet minimum profit percentage, OR be high-profit quick trade
            (bypassesThreshold || meetsThreshold || isCloseWithHighConfidence) // High-profit quick trades bypass threshold
          );
        }
        // If netProfit not calculated yet, require high confidence
        return rec.confidence >= 0.8;
      }
      // Include SELL and HOLD signals for information
      return true;
    });

    // Calculate profit per month for all BUY recommendations
    // Use the same duration calculation as display to ensure consistency
    viableRecommendations.forEach((rec) => {
      if (rec.action === "BUY") {
        // Use executionPlan.totalDays if available, otherwise use rec.duration or maxTradeDurationDays
        // Store duration on rec so display uses the same value
        const duration =
          rec.executionPlan?.totalDays ||
          rec.duration ||
          rec.maxTradeDurationDays ||
          2;
        rec.duration = duration; // Store for display consistency
        rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
      }
    });

    // Filter by top percentile of profit per month (only for BUY recommendations)
    const buyRecs = viableRecommendations.filter((r) => r.action === "BUY");
    const nonBuyRecs = viableRecommendations.filter((r) => r.action !== "BUY");

    if (buyRecs.length > 0) {
      // Calculate percentile threshold (default: top 20%)
      const percentileThreshold =
        this.config.trading.profitPerMonthPercentile || 0.2;

      // Sort by profit per month (descending) to get top recommendations
      const sortedByProfitPerMonth = [...buyRecs].sort(
        (a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0)
      );

      // Calculate how many recommendations to keep (top percentile)
      // Use Math.ceil to ensure we keep at least 1 if there are any recommendations
      const numToKeep = Math.max(
        1,
        Math.ceil(sortedByProfitPerMonth.length * percentileThreshold)
      );

      // Take the top N recommendations (percentile-based, no absolute minimum)
      const topPercentileRecs = sortedByProfitPerMonth.slice(0, numToKeep);

      // Combine top percentile BUY recs with non-BUY recs
      viableRecommendations = [...topPercentileRecs, ...nonBuyRecs];
    }

    // Sort by action priority (BUY > SELL > HOLD), then by net profit (highest first), then confidence
    viableRecommendations.sort((a, b) => {
      const actionPriority = { BUY: 3, SELL: 2, HOLD: 1 };
      if (actionPriority[b.action] !== actionPriority[a.action]) {
        return actionPriority[b.action] - actionPriority[a.action];
      }

      // For BUY signals, prioritize by profit percentage first, then absolute profit, then confidence
      if (a.action === "BUY" && b.action === "BUY") {
        // Calculate profit percentages
        const aTotalCost = (a.entryPrice || 0) * (a.quantity || 0) * 1.02;
        const bTotalCost = (b.entryPrice || 0) * (b.quantity || 0) * 1.02;
        const aProfitPercent =
          aTotalCost > 0 ? ((a.netProfit || 0) / aTotalCost) * 100 : 0;
        const bProfitPercent =
          bTotalCost > 0 ? ((b.netProfit || 0) / bTotalCost) * 100 : 0;

        // Sort by profit percentage first (higher is better)
        if (Math.abs(aProfitPercent - bProfitPercent) > 0.1) {
          return bProfitPercent - aProfitPercent;
        }

        // If profit percentages are similar, sort by absolute profit
        const aProfit = a.netProfit || 0;
        const bProfit = b.netProfit || 0;
        if (Math.abs(aProfit - bProfit) > 1000) {
          return bProfit - aProfit;
        }
      }

      return b.confidence - a.confidence;
    });

    // Limit to available slots for BUY recommendations
    const buyRecommendations = viableRecommendations.filter(
      (r) => r.action === "BUY"
    );
    const availableSlots = this.positionManager.getAvailableSlots();

    let finalRecommendations = viableRecommendations;
    if (buyRecommendations.length > availableSlots) {
      // Keep only top recommendations by profit
      const topBuys = buyRecommendations.slice(0, availableSlots);
      const others = viableRecommendations.filter((r) => r.action !== "BUY");
      finalRecommendations = [...topBuys, ...others];
    }

    // Return the filtered recommendations (already limited by percentile)
    return finalRecommendations;
  }

  /**
   * Display trading recommendations
   * @private
   */
  displayRecommendations(recommendations) {
    if (recommendations.length === 0) {
      console.log(
        chalk.yellow("⚠️  No trading opportunities found at this time.\n")
      );
      return;
    }

    // Group by duration
    const byDuration = {
      1: recommendations.filter((r) => r.duration === 1 && r.action === "BUY"),
      3: recommendations.filter((r) => r.duration === 3 && r.action === "BUY"),
      5: recommendations.filter((r) => r.duration === 5 && r.action === "BUY"),
    };

    console.log(chalk.bold("\n📋 Trading Recommendations:\n"));

    // Calculate profit per month for all BUY recommendations
    const allBuyRecs = recommendations.filter(
      (r) => r.action === "BUY" && r.duration
    );
    allBuyRecs.forEach((rec) => {
      const duration = rec.duration || this.config.trading.maxTradeDurationDays;
      rec.profitPerMonth = (rec.netProfit || 0) * (30 / duration);
    });

    // Find the highest profit per month across all recommendations
    const highestProfitPerMonth =
      allBuyRecs.length > 0
        ? Math.max(...allBuyRecs.map((r) => r.profitPerMonth || 0))
        : 0;

    // Award "Highest Profit Per Month" to only the highest
    allBuyRecs.forEach((rec) => {
      if (
        rec.profitPerMonth === highestProfitPerMonth &&
        highestProfitPerMonth > 0
      ) {
        rec.benefits =
          !rec.benefits ||
          rec.benefits === "" ||
          rec.benefits === "Standard Trade"
            ? "Highest Profit Per Month"
            : rec.benefits + ", Highest Profit Per Month";
      }
    });

    // Award "Highest Confidence" to highest confidence trade in each duration group
    [1, 3, 5].forEach((duration) => {
      const durationRecs = allBuyRecs.filter((r) => r.duration === duration);
      if (durationRecs.length > 0) {
        const highestConfidence = Math.max(
          ...durationRecs.map((r) => r.confidence || 0)
        );

        // Only award if confidence is >= 85%
        if (highestConfidence >= 0.85) {
          durationRecs.forEach((rec) => {
            if (rec.confidence === highestConfidence) {
              rec.benefits =
                !rec.benefits ||
                rec.benefits === "" ||
                rec.benefits === "Standard Trade"
                  ? "Highest Confidence"
                  : rec.benefits + ", Highest Confidence";
            }
          });
        }
      }
    });

    // Award percentile-based benefits (top 10% for most metrics)
    if (allBuyRecs.length > 0) {
      // Calculate percentiles for various metrics
      const volumes = allBuyRecs
        .map((r) => r.avgDailyVolume || 0)
        .filter((v) => v > 0)
        .sort((a, b) => b - a);
      const profits = allBuyRecs
        .map((r) => r.netProfit || 0)
        .filter((p) => p > 0)
        .sort((a, b) => b - a);
      const profitMargins = allBuyRecs
        .map((r) => {
          if (r.netProfit && r.quantity && r.entryPrice) {
            const profitPerUnit = r.netProfit / r.quantity;
            return (profitPerUnit / r.entryPrice) * 100;
          }
          return 0;
        })
        .filter((m) => m > 0)
        .sort((a, b) => b - a);

      // Top 10 percentile index (90th percentile)
      const top10Index = Math.max(0, Math.floor(allBuyRecs.length * 0.1));
      const top10VolumeThreshold = volumes.length > 0 ? volumes[top10Index] : 0;
      const top10ProfitThreshold = profits.length > 0 ? profits[top10Index] : 0;
      const top10MarginThreshold =
        profitMargins.length > 0 ? profitMargins[top10Index] : 0;

      // Award "High Volume" to top 10% by volume
      allBuyRecs.forEach((rec) => {
        if (rec.avgDailyVolume && rec.avgDailyVolume >= top10VolumeThreshold) {
          rec.benefits =
            !rec.benefits ||
            rec.benefits === "" ||
            rec.benefits === "Standard Trade"
              ? "High Volume"
              : rec.benefits + ", High Volume";
        }
      });

      // Award "Most Profitable" to top 10% by profit (if not already awarded)
      allBuyRecs.forEach((rec) => {
        if (
          rec.netProfit &&
          rec.netProfit >= top10ProfitThreshold &&
          (!rec.benefits || !rec.benefits.includes("Most Profitable"))
        ) {
          rec.benefits =
            !rec.benefits ||
            rec.benefits === "" ||
            rec.benefits === "Standard Trade"
              ? "Most Profitable"
              : rec.benefits + ", Most Profitable";
        }
      });

      // Award "Best Value" to top 10% by profit margin (if not already awarded)
      allBuyRecs.forEach((rec) => {
        if (rec.netProfit && rec.quantity && rec.entryPrice) {
          const profitPerUnit = rec.netProfit / rec.quantity;
          const profitMargin = (profitPerUnit / rec.entryPrice) * 100;
          if (
            profitMargin >= top10MarginThreshold &&
            (!rec.benefits || !rec.benefits.includes("Best Value"))
          ) {
            rec.benefits =
              !rec.benefits ||
              rec.benefits === "" ||
              rec.benefits === "Standard Trade"
                ? "Best Value"
                : rec.benefits + ", Best Value";
          }
        }
      });
    }

    // Display by duration
    [1, 3, 5].forEach((duration) => {
      const durationRecs = byDuration[duration];
      if (durationRecs.length > 0) {
        // Sort by net profit (highest first)
        durationRecs.sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));

        console.log(
          chalk.bold(
            `\n${
              duration === 1 ? "⚡" : duration === 3 ? "📅" : "📆"
            } ${duration}-Day Trades:`
          )
        );
        console.log(chalk.gray("─".repeat(80)));

        durationRecs.slice(0, 3).forEach((rec, index) => {
          this.displaySingleRecommendation(rec, index + 1);
        });
      }
    });

    // Show other recommendations (SELL, HOLD)
    const otherRecs = recommendations.filter(
      (r) => r.action !== "BUY" || !r.duration
    );
    if (otherRecs.length > 0) {
      console.log(chalk.bold("\n📊 Other Recommendations:"));
      console.log(chalk.gray("─".repeat(80)));
      otherRecs.forEach((rec, index) => {
        this.displaySingleRecommendation(rec, index + 1);
      });
    }

    // Calculate total monthly potential if running all 3 positions simultaneously
    const top3ByProfitPerMonth = allBuyRecs
      .sort((a, b) => (b.profitPerMonth || 0) - (a.profitPerMonth || 0))
      .slice(0, this.positionManager.maxPositions);

    if (top3ByProfitPerMonth.length > 0) {
      const totalMonthlyProfit = top3ByProfitPerMonth.reduce(
        (sum, rec) => sum + (rec.profitPerMonth || 0),
        0
      );
      const totalCapitalUsed = top3ByProfitPerMonth.reduce(
        (sum, rec) => sum + (rec.totalCost || 0),
        0
      );

      // Calculate average profit per trade and ROI
      const avgProfitPerTrade =
        top3ByProfitPerMonth.reduce(
          (sum, rec) => sum + (rec.netProfit || 0),
          0
        ) / top3ByProfitPerMonth.length;

      const avgROI =
        totalCapitalUsed > 0
          ? (avgProfitPerTrade /
              (totalCapitalUsed / top3ByProfitPerMonth.length)) *
            100
          : 0;

      console.log(chalk.gray("\n" + "─".repeat(80)));
      console.log(
        chalk.bold.green(
          `\n💰 Monthly Potential (${this.positionManager.maxPositions} positions running simultaneously):`
        )
      );
      console.log(
        `   Total Monthly Profit: ${chalk.green(
          formatGP(totalMonthlyProfit)
        )} gp`
      );
      console.log(
        `   Capital Used: ${chalk.yellow(formatGP(totalCapitalUsed))} GP (${(
          (totalCapitalUsed / this.config.trading.baseCapital) *
          100
        ).toFixed(1)}% of ${formatGP(this.config.trading.baseCapital)} GP)`
      );
      console.log(
        `   Average Profit Per Trade: ${chalk.cyan(
          formatGP(avgProfitPerTrade)
        )} gp`
      );
      console.log(
        `   Average ROI Per Trade: ${chalk.cyan(avgROI.toFixed(1))}%`
      );
    }

    console.log(chalk.gray("\n" + "─".repeat(80)));
    console.log(
      chalk.dim(
        `\n💡 Remember: F2P accounts can only hold ${this.positionManager.maxPositions} items at a time\n`
      )
    );
  }

  /**
   * Display a single recommendation
   * @private
   */
  displaySingleRecommendation(rec, index) {
    const actionColor =
      rec.action === "BUY"
        ? chalk.green
        : rec.action === "SELL"
        ? chalk.red
        : chalk.yellow;

    console.log(`\n${index}. ${chalk.bold(rec.item)}`);
    console.log(`   Action: ${actionColor.bold(rec.action)}`);
    console.log(
      `   Confidence: ${chalk.cyan((rec.confidence * 100).toFixed(1) + "%")}`
    );

    // Calculate and display duration and monthly profit for BUY trades
    if (rec.action === "BUY") {
      const duration = rec.duration || this.config.trading.maxTradeDurationDays;
      const netProfit =
        rec.netProfit || (rec.exitPrice - rec.entryPrice) * rec.quantity;

      // Calculate profit per month (assuming we repeat the trade)
      // 30 days / duration = trades per month
      const tradesPerMonth = 30 / duration;
      const profitPerMonth = netProfit * tradesPerMonth;

      console.log(
        `   Expected Duration: ${chalk.cyan(
          `≤ ${duration} days`
        )} | ${chalk.bold("Profit/Month:")} ${chalk.green(
          formatGP(Math.floor(profitPerMonth))
        )} gp`
      );
    }

    console.log(
      `   Current Price: ${chalk.white(
        formatGP(Math.floor(rec.currentPrice))
      )} GP`
    );

    if (rec.action === "BUY") {
      console.log(
        `   Entry Price: ${chalk.green(
          formatGP(Math.floor(rec.entryPrice))
        )} gp`
      );
      console.log(
        `   Target Exit: ${chalk.green(formatGP(Math.floor(rec.exitPrice)))} GP`
      );
      console.log(
        `   Stop Loss: ${chalk.red(formatGP(Math.floor(rec.stopLoss)))} GP`
      );
      console.log(
        `   Quantity: ${chalk.white(rec.quantity.toLocaleString())} units`
      );

      // Calculate costs and profits
      const totalCost = rec.totalCost || 0;
      console.log(
        `   ${chalk.bold("Total Cost:")} ${chalk.yellow(
          formatGP(totalCost)
        )} GP ${chalk.dim("(including GE fees)")}`
      );

      // Show net profit (after fees)
      const netProfit =
        rec.netProfit || (rec.exitPrice - rec.entryPrice) * rec.quantity;
      const grossProfit = (rec.exitPrice - rec.entryPrice) * rec.quantity;
      // Calculate profit margin as (netProfit / totalCost) * 100
      // This accounts for fees, unlike the simple per-unit price difference
      // Use existing totalCost variable from above
      const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      const profitColor =
        netProfit >= this.config.trading.targetProfitPerTrade
          ? chalk.green
          : netProfit >= this.config.trading.minProfitPerTrade
          ? chalk.yellow
          : chalk.red;

      console.log(
        `   ${chalk.bold("Net Profit:")} ${profitColor(
          formatGP(netProfit)
        )} GP ${chalk.dim(
          `(after ${rec.entryPrice > 50 ? "2%" : "0%"} GE fees)`
        )}`
      );

      if (grossProfit !== netProfit && rec.entryPrice > 50) {
        const fees = grossProfit - netProfit;
        console.log(`   ${chalk.dim(`Fees: ${formatGP(fees)} GP`)}`);
      }

      console.log(
        `   ${chalk.bold("Profit Margin:")} ${chalk.cyan(
          profitPercent.toFixed(2) + "%"
        )}`
      );

      // Show explanation and benefits
      if (rec.explanation) {
        console.log(`   ${chalk.bold("Why:")} ${chalk.white(rec.explanation)}`);
      }
      if (rec.benefits) {
        console.log(
          `   ${chalk.bold("Benefits:")} ${chalk.cyan(rec.benefits)}`
        );
      }

      // Don't show "Below minimum target" warning - if it's shown, it should meet our thresholds
      // The filtering should have already removed trades that don't meet minimums
    }

    if (rec.reason) {
      console.log(`   Note: ${chalk.yellow(rec.reason)}`);
    }
  }

  /**
   * Get current positions summary
   */
  getPositionsSummary() {
    const positions = this.positionManager.getAllPositions();

    if (positions.length === 0) {
      return chalk.yellow("No active positions");
    }

    return positions
      .map((pos) => {
        return `${pos.item}: ${pos.quantity} @ ${pos.buyPrice} gp`;
      })
      .join("\n");
  }
}
