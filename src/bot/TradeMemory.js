import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * TradeMemory - Manages approved trades that match in-game GE slots
 * Tracks up to 3 trades (max GE slots) with ability to edit price, quantity, and manage trades
 */
export class TradeMemory {
  constructor() {
    this.memoryFile = path.join(__dirname, "../../.cache", "trade-memory.json");
    this.trades = [];
    this.maxTrades = 3; // Maximum GE slots
  }

  /**
   * Add a trade to memory (up to maxTrades)
   * @param {Object} trade - Trade object with item, action, quantity, price, index
   */
  addTrade(trade) {
    if (this.trades.length >= this.maxTrades) {
      throw new Error(`Cannot add more than ${this.maxTrades} trades (max GE slots)`);
    }

    // Ensure index is set
    if (trade.index === undefined) {
      trade.index = this.trades.length;
    }

    this.trades.push(trade);
  }

  /**
   * Update a trade by index
   * @param {number} index - Index of trade to update
   * @param {Object} updates - Object with fields to update (price, quantity, etc.)
   */
  updateTrade(index, updates) {
    if (index < 0 || index >= this.trades.length) {
      throw new Error(`Invalid trade index: ${index}`);
    }

    this.trades[index] = { ...this.trades[index], ...updates };
  }

  /**
   * Delete a trade by index
   * @param {number} index - Index of trade to delete
   */
  deleteTrade(index) {
    if (index < 0 || index >= this.trades.length) {
      throw new Error(`Invalid trade index: ${index}`);
    }

    this.trades.splice(index, 1);
    
    // Re-index remaining trades
    this.trades.forEach((trade, i) => {
      trade.index = i;
    });
  }

  /**
   * Get a trade by index
   * @param {number} index - Index of trade to get
   * @returns {Object|null} Trade object or null if not found
   */
  getTrade(index) {
    if (index < 0 || index >= this.trades.length) {
      return null;
    }
    return this.trades[index];
  }

  /**
   * Save trades to file
   */
  async save() {
    try {
      const cacheDir = path.dirname(this.memoryFile);
      await fs.mkdir(cacheDir, { recursive: true });

      const data = {
        trades: this.trades,
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(this.memoryFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Warning: Could not save trade memory:", error.message);
    }
  }

  /**
   * Load trades from file
   */
  async load() {
    try {
      const data = await fs.readFile(this.memoryFile, "utf-8");
      const parsed = JSON.parse(data);
      
      if (parsed.trades && Array.isArray(parsed.trades)) {
        this.trades = parsed.trades;
      }
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      this.trades = [];
    }
  }

  /**
   * Clear all trades
   */
  clear() {
    this.trades = [];
  }
}
