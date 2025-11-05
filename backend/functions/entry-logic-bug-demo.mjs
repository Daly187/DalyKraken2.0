console.log('=== DEMONSTRATING THE ENTRY LOGIC BUG ===\n');

function calculateNextStepPercent(entryNumber, baseStepPercent, stepMultiplier) {
  if (entryNumber === 0) return baseStepPercent;
  return baseStepPercent * Math.pow(stepMultiplier, entryNumber);
}

// Scenario that demonstrates the bug:
// Bot has 3 entries at progressively lower prices
// Price rebounds slightly but is still below the calculated next entry target from last entry
// Current logic will BLOCK entry, but correct logic would ALLOW it

const entries = [
  { price: 10.00, date: 'Jan 1' },   // Entry 1
  { price: 9.80, date: 'Jan 2' },    // Entry 2 (2% drop)
  { price: 9.20, date: 'Jan 3' },    // Entry 3 (8% drop from entry 2)
];

const lastEntryPrice = entries[entries.length - 1].price;  // $9.20
const currentPrice = 9.40;  // Price rebounded slightly to $9.40

const stepPercent = 1;
const stepMultiplier = 2;
const filledCount = entries.length;

console.log('Bot History:');
entries.forEach((e, i) => {
  console.log(`  Entry ${i + 1}: $${e.price.toFixed(2)} (${e.date})`);
});
console.log('');

console.log(`Last Entry Price: $${lastEntryPrice.toFixed(2)}`);
console.log(`Current Price: $${currentPrice.toFixed(2)}`);
console.log(`Price vs Last Entry: ${currentPrice > lastEntryPrice ? '+' : ''}${((currentPrice - lastEntryPrice) / lastEntryPrice * 100).toFixed(2)}%`);
console.log('');

const nextStepPercent = calculateNextStepPercent(filledCount, stepPercent, stepMultiplier);
console.log(`Next Step %: ${nextStepPercent.toFixed(2)}% (${stepPercent}% * ${stepMultiplier}^${filledCount})`);
console.log('');

// CURRENT (BROKEN) LOGIC
console.log('=== CURRENT LOGIC (from current price) ===');
const nextEntryPriceBroken = currentPrice * (1 - nextStepPercent / 100);
console.log(`Target Entry Price: $${currentPrice.toFixed(2)} * (1 - ${nextStepPercent}%) = $${nextEntryPriceBroken.toFixed(2)}`);
console.log(`Current: $${currentPrice.toFixed(2)} > Target: $${nextEntryPriceBroken.toFixed(2)}?`);
if (currentPrice > nextEntryPriceBroken) {
  console.log(`  ❌ YES - BLOCKED (current price must drop ${nextStepPercent}% from $${currentPrice.toFixed(2)} to $${nextEntryPriceBroken.toFixed(2)})`);
} else {
  console.log(`  ✅ NO - ALLOWED`);
}
console.log('');

// CORRECT LOGIC
console.log('=== CORRECT LOGIC (from last entry price) ===');
const nextEntryPriceCorrect = lastEntryPrice * (1 - nextStepPercent / 100);
console.log(`Target Entry Price: $${lastEntryPrice.toFixed(2)} * (1 - ${nextStepPercent}%) = $${nextEntryPriceCorrect.toFixed(2)}`);
console.log(`Current: $${currentPrice.toFixed(2)} > Target: $${nextEntryPriceCorrect.toFixed(2)}?`);
if (currentPrice > nextEntryPriceCorrect) {
  console.log(`  ❌ YES - BLOCKED (price must drop to $${nextEntryPriceCorrect.toFixed(2)})`);
} else {
  console.log(`  ✅ NO - ALLOWED (price is at or below $${nextEntryPriceCorrect.toFixed(2)})`);
}
console.log('');

console.log('=== THE FUNDAMENTAL PROBLEM ===');
console.log('');
console.log('The current logic calculates the next entry price as a % drop from CURRENT price.');
console.log('This means the target price moves UP and DOWN with the market.');
console.log('');
console.log('Example timeline:');
console.log('  1. Last entry at $9.20');
console.log('  2. Price drops to $9.00 → Target: $8.28 ($9.00 * 0.92) → BLOCKED');
console.log('  3. Price rebounds to $9.40 → Target: $8.65 ($9.40 * 0.92) → BLOCKED');
console.log('  4. Price drops to $9.10 → Target: $8.37 ($9.10 * 0.92) → BLOCKED');
console.log('');
console.log('The target keeps changing! The bot can NEVER enter because the target');
console.log('moves with the price. It needs to drop 8% from wherever it currently is.');
console.log('');
console.log('CORRECT behavior:');
console.log('  1. Last entry at $9.20');
console.log('  2. Target is FIXED at $8.46 ($9.20 * 0.92)');
console.log('  3. Whenever price drops to $8.46 or below → ENTER');
console.log('  4. The target never changes until an entry is filled');
console.log('');

console.log('=== THE FIX ===');
console.log('');
console.log('File: backend/functions/src/services/dcaBotService.ts');
console.log('Line: ~208');
console.log('');
console.log('CHANGE FROM:');
console.log('  nextEntryPrice = currentPrice * (1 - nextStepPercent / 100);');
console.log('');
console.log('CHANGE TO:');
console.log('  const lastFilledEntry = filledEntries[filledEntries.length - 1];');
console.log('  nextEntryPrice = lastFilledEntry.price * (1 - nextStepPercent / 100);');
console.log('');
console.log('This will set a FIXED target price based on the last entry,');
console.log('which doesn\'t move with market fluctuations.');
