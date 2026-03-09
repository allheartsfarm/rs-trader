/**
 * PositionManager - Manages trading positions with F2P limit of 3 items
 */
export class PositionManager {
  constructor(maxPositions = 3) {
    this.maxPositions = maxPositions;
    this.positions = new Map();
  }

  /**
   * Add a new position
   * @param {Object} position - { item, quantity, buyPrice, ... }
   * @throws {Error} If max positions reached
   */
  addPosition(position) {
    if (this.positions.size >= this.maxPositions) {
      throw new Error(`Maximum positions reached (${this.maxPositions} for F2P)`);
    }

    if (this.positions.has(position.item)) {
      throw new Error(`Position already exists for ${position.item}`);
    }

    this.positions.set(position.item, {
      ...position,
      addedAt: new Date()
    });
  }

  /**
   * Remove a position
   * @param {string} item - Item name
   * @returns {boolean} True if removed, false if not found
   */
  removePosition(item) {
    return this.positions.delete(item);
  }

  /**
   * Check if position exists
   * @param {string} item - Item name
   * @returns {boolean}
   */
  hasPosition(item) {
    return this.positions.has(item);
  }

  /**
   * Get position details
   * @param {string} item - Item name
   * @returns {Object|null}
   */
  getPosition(item) {
    return this.positions.get(item) || null;
  }

  /**
   * Get all positions
   * @returns {Array}
   */
  getAllPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get current position count
   * @returns {number}
   */
  getPositionCount() {
    return this.positions.size;
  }

  /**
   * Get available slots
   * @returns {number}
   */
  getAvailableSlots() {
    return this.maxPositions - this.positions.size;
  }

  /**
   * Clear all positions
   */
  clear() {
    this.positions.clear();
  }
}
