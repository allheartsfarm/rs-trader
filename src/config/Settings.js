import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Settings - Manages configuration for the trading bot
 */
export class Settings {
  constructor(settingsPath = null) {
    this.settingsPath =
      settingsPath || path.join(__dirname, "../../settings.json");
    this.config = null;
    this.defaults = {
      trading: {
        minProfitPerTrade: 500000, // Minimum 500k gp per trade
        targetProfitPerTrade: 1000000, // Target 1M gp per trade
        baseCapital: 10000000, // 10M gp base capital
        maxPositions: 3, // F2P limit
        minConfidence: 0.3,
        profitTargetPercent: {
          min: 0.05, // 5% minimum
          max: 0.2, // 20% maximum (increased for higher profits)
        },
        minProfitPercent: 0.01, // Minimum 1% profit margin to show recommendation
        positionSizePercent: 0.33, // 33% of capital per position
        maxTradeDurationDays: 2, // Maximum days to hold a position (for quick flips)
        profitPerMonthPercentile: 0.2, // Show top 20% of recommendations by profit per month
        minProfitPerMonth: 100000, // Minimum 100k gp profit per month (absolute threshold)
      },
      strategies: {
        momentum: {
          lookbackPeriod: 5,
          profitCap: 0.12,
          weight: 0.9, // Less important - works for trending items
          maxConfidence: 0.9, // Maximum confidence this strategy can return
        },
        meanReversion: {
          lookbackPeriod: 20,
          deviationThreshold: 0.1,
          profitCap: 0.15,
          weight: 1.2, // Most important - many items have price floors
          maxConfidence: 0.85,
        },
        volume: {
          lookbackPeriod: 10,
          profitCap: 0.1,
          weight: 1.15, // Very important - identifies real moves vs noise
          maxConfidence: 0.9,
        },
        rsi: {
          period: 14,
          overbought: 70,
          oversold: 30,
          weight: 1.0, // Good for timing entries/exits
          maxConfidence: 0.9,
        },
        movingAverage: {
          shortPeriod: 10,
          longPeriod: 20,
          weight: 0.8, // Less important - confirms other signals
          maxConfidence: 0.75,
        },
        supportResistance: {
          lookbackPeriod: 30,
          proximityThreshold: 0.02,
          weight: 1.1, // Important - many items trade in ranges
          maxConfidence: 0.85,
        },
      },
      data: {
        cacheTimeout: 300000, // 5 minutes
        historicalDays: 30, // How many days to fetch from API (API limit)
        maxHistoricalDays: 365, // Maximum days to keep in our collected database
        includeMembersItems: false, // Default to F2P items only
        incrementalCollection: true, // Append new data instead of replacing
      },
    };
  }

  /**
   * Load settings from file or use defaults
   */
  async load() {
    try {
      const fileContent = await fs.readFile(this.settingsPath, "utf-8");
      const userSettings = JSON.parse(fileContent);
      this.config = this.mergeSettings(this.defaults, userSettings);
      this.validateSettings();
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, use defaults
        this.config = { ...this.defaults };
        // Create default settings file
        await this.save();
      } else {
        console.error("Error loading settings:", error.message);
        this.config = { ...this.defaults };
      }
    }
  }

  /**
   * Save current settings to file
   */
  async save() {
    try {
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(this.config || this.defaults, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Error saving settings:", error.message);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    if (!this.config) {
      this.config = { ...this.defaults };
    }
    return this.config;
  }

  /**
   * Merge user settings with defaults (deep merge)
   */
  mergeSettings(defaults, userSettings) {
    const merged = { ...defaults };

    for (const key in userSettings) {
      if (
        typeof userSettings[key] === "object" &&
        !Array.isArray(userSettings[key]) &&
        userSettings[key] !== null
      ) {
        merged[key] = this.mergeSettings(
          defaults[key] || {},
          userSettings[key]
        );
      } else {
        merged[key] = userSettings[key];
      }
    }

    return merged;
  }

  /**
   * Validate settings and fix invalid values
   */
  validateSettings() {
    const trading = this.config.trading;

    // Validate profit targets
    if (trading.minProfitPerTrade < 0) {
      trading.minProfitPerTrade = this.defaults.trading.minProfitPerTrade;
    }
    if (trading.targetProfitPerTrade < trading.minProfitPerTrade) {
      trading.targetProfitPerTrade = trading.minProfitPerTrade * 2;
    }
    if (trading.baseCapital < 1000000) {
      trading.baseCapital = this.defaults.trading.baseCapital;
    }
    if (trading.maxPositions < 1 || trading.maxPositions > 3) {
      trading.maxPositions = 3; // F2P limit
    }
    if (trading.minConfidence < 0 || trading.minConfidence > 1) {
      trading.minConfidence = this.defaults.trading.minConfidence;
    }

    // Validate profit percent range
    if (
      trading.profitTargetPercent.min < 0 ||
      trading.profitTargetPercent.min > trading.profitTargetPercent.max
    ) {
      trading.profitTargetPercent.min =
        this.defaults.trading.profitTargetPercent.min;
    }
    if (trading.profitTargetPercent.max > 0.5) {
      // Cap at 50% max
      trading.profitTargetPercent.max = 0.5;
    }
    if (
      !trading.maxTradeDurationDays ||
      trading.maxTradeDurationDays < 1 ||
      trading.maxTradeDurationDays > 7
    ) {
      trading.maxTradeDurationDays = this.defaults.trading.maxTradeDurationDays;
    }
  }
}
