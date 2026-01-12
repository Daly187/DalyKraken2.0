#!/usr/bin/env node

/**
 * Check which wallet address a private key derives to
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        env[key.trim()] = value.trim();
      }
    }
    return env;
  } catch (error) {
    return {};
  }
}

async function checkWallet(privateKey) {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

async function main() {
  const args = process.argv.slice(2);
  const privateKey = args[0];

  if (!privateKey) {
    console.error('Usage: node check-wallet.js <private_key>');
    process.exit(1);
  }

  try {
    const address = await checkWallet(privateKey);
    console.log('\n🔍 Wallet Check Results:');
    console.log('========================');
    console.log('Private Key:', privateKey.substring(0, 10) + '...' + privateKey.substring(privateKey.length - 10));
    console.log('Derives to:', address);
    console.log('========================\n');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
