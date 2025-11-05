console.log('=== ANALYZING XRP/USD BOT ===\n');

function calculateNextStepPercent(entryNumber, baseStepPercent, stepMultiplier) {
  if (entryNumber === 0) return baseStepPercent;
  return baseStepPercent * Math.pow(stepMultiplier, entryNumber);
}

// XRP Bot Configuration from screenshot
const botConfig = {
  symbol: 'XRP/USD',
  stepPercent: 1,        // 1%
  stepMultiplier: 2,     // 2x
  filledEntries: 1,      // Has 1 filled entry
  lastEntryPrice: 2.65,  // Entry #1 at $2.65
  currentPrice: 2.33,    // Current price $2.33
  displayedNextEntry: 2.29 // What the UI shows
};

console.log('Bot Configuration:');
console.log(`  Symbol: ${botConfig.symbol}`);
console.log(`  Step %: ${botConfig.stepPercent}%`);
console.log(`  Step Multiplier: ${botConfig.stepMultiplier}x`);
console.log(`  Filled Entries: ${botConfig.filledEntries}`);
console.log('');

console.log('Market Data:');
console.log(`  Last Entry Price (Entry #1): $${botConfig.lastEntryPrice.toFixed(2)}`);
console.log(`  Current Price: $${botConfig.currentPrice.toFixed(2)}`);
console.log(`  Price Change: ${((botConfig.currentPrice - botConfig.lastEntryPrice) / botConfig.lastEntryPrice * 100).toFixed(2)}%`);
console.log('');

// Calculate the next step percentage for entry #2
const nextStepPercent = calculateNextStepPercent(
  botConfig.filledEntries,  // 1 filled entry, so this calculates for entry #2
  botConfig.stepPercent,
  botConfig.stepMultiplier
);

console.log('=== CALCULATING NEXT ENTRY PRICE (Entry #2) ===');
console.log(`Next Step %: ${botConfig.stepPercent}% * ${botConfig.stepMultiplier}^${botConfig.filledEntries} = ${nextStepPercent.toFixed(2)}%`);
console.log('');

// After my fix - should calculate from last entry price
const nextEntryPriceFixed = botConfig.lastEntryPrice * (1 - nextStepPercent / 100);
console.log('AFTER FIX (from last entry price):');
console.log(`  Formula: lastEntryPrice * (1 - nextStepPercent / 100)`);
console.log(`  Calculation: $${botConfig.lastEntryPrice.toFixed(2)} * (1 - ${nextStepPercent}% / 100)`);
console.log(`  Calculation: $${botConfig.lastEntryPrice.toFixed(2)} * ${(1 - nextStepPercent / 100).toFixed(4)}`);
console.log(`  Next Entry Price: $${nextEntryPriceFixed.toFixed(2)}`);
console.log(`  Drop needed from last entry: ${nextStepPercent}%`);
console.log('');

// What the UI is showing
console.log('UI DISPLAY:');
console.log(`  Showing: $${botConfig.displayedNextEntry.toFixed(2)}`);
console.log(`  Difference: $${Math.abs(nextEntryPriceFixed - botConfig.displayedNextEntry).toFixed(4)}`);
console.log('');

// Check if current price qualifies for entry
console.log('=== ENTRY QUALIFICATION CHECK ===');
console.log(`Current Price ($${botConfig.currentPrice.toFixed(2)}) <= Next Entry Price ($${nextEntryPriceFixed.toFixed(2)})?`);

if (botConfig.currentPrice <= nextEntryPriceFixed) {
  console.log(`  ✅ YES - Bot SHOULD create a pending order!`);
  console.log(`  Price has dropped ${((botConfig.lastEntryPrice - botConfig.currentPrice) / botConfig.lastEntryPrice * 100).toFixed(2)}% from last entry`);
  console.log(`  Only needed ${nextStepPercent}% drop`);
} else {
  console.log(`  ❌ NO - Price needs to drop more`);
  console.log(`  Current drop: ${((botConfig.lastEntryPrice - botConfig.currentPrice) / botConfig.lastEntryPrice * 100).toFixed(2)}%`);
  console.log(`  Required drop: ${nextStepPercent}%`);
  console.log(`  Additional drop needed: ${((botConfig.currentPrice - nextEntryPriceFixed) / botConfig.currentPrice * 100).toFixed(2)}%`);
}
console.log('');

// Check what the UI is showing
console.log('=== WHAT UI SHOWS ===');
console.log(`Current Price ($${botConfig.currentPrice.toFixed(2)}) <= UI Target ($${botConfig.displayedNextEntry.toFixed(2)})?`);
if (botConfig.currentPrice <= botConfig.displayedNextEntry) {
  console.log(`  ✅ YES - Should enter`);
} else {
  console.log(`  ❌ NO - Waiting for ${((botConfig.displayedNextEntry - botConfig.currentPrice) / botConfig.currentPrice * 100).toFixed(2)}% more drop`);
  console.log(`  Current: $${botConfig.currentPrice.toFixed(2)}`);
  console.log(`  Target: $${botConfig.displayedNextEntry.toFixed(2)}`);
  console.log(`  Difference: $${(botConfig.displayedNextEntry - botConfig.currentPrice).toFixed(2)}`);
}
console.log('');

console.log('=== DIAGNOSIS ===');
const actualDropPercent = ((botConfig.lastEntryPrice - botConfig.currentPrice) / botConfig.lastEntryPrice * 100);
console.log(`Actual price drop from last entry: ${actualDropPercent.toFixed(2)}%`);
console.log(`Required step % for entry #2: ${nextStepPercent}%`);
console.log('');

if (actualDropPercent >= nextStepPercent) {
  console.log('🔴 BUG CONFIRMED: Price has dropped enough but bot is NOT entering!');
  console.log(`   The fix I deployed should resolve this.`);
  console.log(`   Wait for deployment to complete and next bot processing cycle.`);
} else {
  console.log('⚠️  Price has not dropped enough yet.');
  console.log(`   Need ${(nextStepPercent - actualDropPercent).toFixed(2)}% more drop.`);
}
