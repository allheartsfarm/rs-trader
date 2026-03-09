/**
 * Format gp amounts in RS3 style (e.g., 1629K gp instead of 1,629,982 gp)
 */
export function formatGP(amount) {
  if (amount >= 10000000000) {
    // Billions: 10B gp and above
    const billions = amount / 1000000000;
    // Show 0 decimals for >= 10B (matching millions pattern), 1 decimal for < 10B (but we only use B for >= 10B, so this is for edge cases)
    return `${billions.toFixed(billions >= 10 ? 0 : 1)}B`;
  } else if (amount >= 10000000) {
    // Millions: 10M to 9999M gp
    const millions = amount / 1000000;
    return `${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  } else if (amount >= 1000) {
    // Thousands: 1K to 9999K gp
    const thousands = amount / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}K`;
  } else {
    // Less than 1K: round down to whole gp (no fractions)
    return Math.floor(amount).toString();
  }
}
