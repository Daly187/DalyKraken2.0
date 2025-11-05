console.log('=== ENTRY LOGIC DIAGNOSIS ===\n');

function calculateNextStepPercent(entryNumber, baseStepPercent, stepMultiplier) {
  if (entryNumber === 0) return baseStepPercent;
  return baseStepPercent * Math.pow(stepMultiplier, entryNumber);
}

// Example bot configuration (typical DCA bot)
const botConfig = {
  symbol: 'DOT/USD',
  stepPercent: 1,      // 1% drop per entry
  stepMultiplier: 2,   // Double the step each time
  filledEntries: 3     // Already has 3 filled entries
};

// Scenario: Bot has 3 entries, price has gone up since last entry
const lastEntryPrice = 6.00;  // Last bought at $6.00
const currentPrice = 6.50;    // Price went up to $6.50

console.log('Bot Configuration:');
console.log(`  Symbol: ${botConfig.symbol}`);
console.log(`  Step %: ${botConfig.stepPercent}%`);
console.log(`  Step Multiplier: ${botConfig.stepMultiplier}x`);
console.log(`  Filled Entries: ${botConfig.filledEntries}`);
console.log('');

console.log('Market Conditions:');
console.log(`  Last Entry Price: $${lastEntryPrice.toFixed(2)}`);
console.log(`  Current Price: $${currentPrice.toFixed(2)}`);
console.log(`  Price Change: +${((currentPrice - lastEntryPrice) / lastEntryPrice * 100).toFixed(2)}% (price went UP)`);
console.log('');

// Calculate next step percentage
const nextStepPercent = calculateNextStepPercent(
  botConfig.filledEntries,
  botConfig.stepPercent,
  botConfig.stepMultiplier
);

console.log(`Next Entry Step %: ${nextStepPercent.toFixed(2)}%`);
console.log('  Calculation: ${botConfig.stepPercent}% * ${botConfig.stepMultiplier}^${botConfig.filledEntries} = ${nextStepPercent.toFixed(2)}%');
console.log('');

// CURRENT (BROKEN) LOGIC - calculates from current price
console.log('=== CURRENT (BROKEN) LOGIC ===');
const nextEntryPriceBroken = currentPrice * (1 - nextStepPercent / 100);
console.log(`Formula: currentPrice * (1 - nextStepPercent / 100)`);
console.log(`Next Entry Price: $${nextEntryPriceBroken.toFixed(2)}`);
console.log(`  = $${currentPrice.toFixed(2)} * (1 - ${nextStepPercent.toFixed(2)}% / 100)`);
console.log(`  = $${currentPrice.toFixed(2)} * ${(1 - nextStepPercent / 100).toFixed(4)}`);
console.log(`  = $${nextEntryPriceBroken.toFixed(2)}`);
console.log('');
console.log(`Will bot enter? ${currentPrice} > ${nextEntryPriceBroken.toFixed(2)}?`);
if (currentPrice > nextEntryPriceBroken) {
  console.log(`  ❌ NO - Price ($${currentPrice.toFixed(2)}) is ABOVE target ($${nextEntryPriceBroken.toFixed(2)})`);
  console.log(`  Bot is BLOCKED from entering`);
} else {
  console.log(`  ✅ YES - Price ($${currentPrice.toFixed(2)}) is BELOW target ($${nextEntryPriceBroken.toFixed(2)})`);
}
console.log('');

// CORRECT LOGIC - should calculate from last entry price
console.log('=== CORRECT LOGIC (from last entry) ===');
const nextEntryPriceCorrect = lastEntryPrice * (1 - nextStepPercent / 100);
console.log(`Formula: lastEntryPrice * (1 - nextStepPercent / 100)`);
console.log(`Next Entry Price: $${nextEntryPriceCorrect.toFixed(2)}`);
console.log(`  = $${lastEntryPrice.toFixed(2)} * (1 - ${nextStepPercent.toFixed(2)}% / 100)`);
console.log(`  = $${lastEntryPrice.toFixed(2)} * ${(1 - nextStepPercent / 100).toFixed(4)}`);
console.log(`  = $${nextEntryPriceCorrect.toFixed(2)}`);
console.log('');
console.log(`Will bot enter? ${currentPrice} > ${nextEntryPriceCorrect.toFixed(2)}?`);
if (currentPrice > nextEntryPriceCorrect) {
  console.log(`  ❌ NO - Price ($${currentPrice.toFixed(2)}) is ABOVE target ($${nextEntryPriceCorrect.toFixed(2)})`);
  console.log(`  Bot would still wait for price to drop`);
} else {
  console.log(`  ✅ YES - Price ($${currentPrice.toFixed(2)}) is BELOW target ($${nextEntryPriceCorrect.toFixed(2)})`);
  console.log(`  Bot SHOULD be entering!`);
}
console.log('');

console.log('=== PROBLEM SUMMARY ===');
console.log(`Price Diff: $${Math.abs(nextEntryPriceBroken - nextEntryPriceCorrect).toFixed(2)}`);
console.log(`Percentage Diff: ${Math.abs((nextEntryPriceBroken - nextEntryPriceCorrect) / nextEntryPriceCorrect * 100).toFixed(2)}%`);
console.log('');

if (currentPrice > nextEntryPriceBroken && currentPrice <= nextEntryPriceCorrect) {
  console.log('🔴 CRITICAL BUG IDENTIFIED:');
  console.log('   Current logic BLOCKS entry when it SHOULD allow it!');
  console.log('   Bots cannot re-enter after price increases.');
  console.log('');
  console.log('🔧 FIX NEEDED:');
  console.log('   Change line 208 in dcaBotService.ts from:');
  console.log('     nextEntryPrice = currentPrice * (1 - nextStepPercent / 100);');
  console.log('   To:');
  console.log('     nextEntryPrice = lastEntryPrice * (1 - nextStepPercent / 100);');
} else if (currentPrice > nextEntryPriceBroken && currentPrice > nextEntryPriceCorrect) {
  console.log('⚠️  Both logics agree - price needs to drop more before next entry.');
} else {
  console.log('✅ Both logics agree - bot should be entering.');
}
