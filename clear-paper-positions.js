/**
 * Clear paper trading positions from localStorage
 * 
 * INSTRUCTIONS:
 * 1. Open https://dalydough.web.app in your browser
 * 2. Open Developer Console (F12 or Cmd+Option+I)
 * 3. Paste this entire script and press Enter
 * 4. Refresh the page (F5 or Cmd+R)
 */

// Method 1: Use the service method (if available in window)
if (window.fundingArbitrageService) {
  window.fundingArbitrageService.clearAllPositions();
  console.log('✅ Cleared via fundingArbitrageService.clearAllPositions()');
} else {
  // Method 2: Direct localStorage clear
  localStorage.removeItem('arbitrage_strategy_state');
  console.log('✅ Cleared arbitrage_strategy_state from localStorage');
}

console.log('🔄 Please refresh the page (F5) to see the changes');
console.log('💡 All paper trading positions have been removed');
