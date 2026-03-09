/**
 * Grand Exchange fee calculations
 * RS3 has a 2% fee for items above 50 gp
 */

/**
 * Calculate GE fee for a transaction
 * @param {number} totalValue - Total value of the transaction
 * @param {number} itemPrice - Price per item
 * @returns {number} Fee amount
 */
export function calculateGEFee(totalValue, itemPrice) {
  // No fee for items at or below 50 gp
  if (itemPrice <= 50) {
    return 0;
  }
  
  // 2% fee for items above 50 gp
  return totalValue * 0.02;
}

/**
 * Calculate net profit after GE fees
 * @param {number} entryPrice - Buy price per item
 * @param {number} exitPrice - Sell price per item
 * @param {number} quantity - Number of items
 * @returns {number} Net profit after fees
 */
export function calculateNetProfit(entryPrice, exitPrice, quantity) {
  const grossProfit = (exitPrice - entryPrice) * quantity;
  const entryCost = entryPrice * quantity;
  const exitRevenue = exitPrice * quantity;
  
  const entryFee = calculateGEFee(entryCost, entryPrice);
  const exitFee = calculateGEFee(exitRevenue, exitPrice);
  
  return grossProfit - entryFee - exitFee;
}

/**
 * Calculate total upfront cost (including fees)
 * @param {number} entryPrice - Buy price per item
 * @param {number} quantity - Number of items
 * @returns {number} Total cost including fees
 */
export function calculateTotalCost(entryPrice, quantity) {
  const baseCost = entryPrice * quantity;
  const fee = calculateGEFee(baseCost, entryPrice);
  return baseCost + fee;
}
