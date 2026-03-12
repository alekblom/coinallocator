import type { RecipientConfig } from '../types';
import { getActiveChain } from '../chain/manager';
import { isEvmChain } from '../evm/networks';

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function isValidSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function isValidSuiAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

function isValidAddressForChain(address: string): boolean {
  const chain = getActiveChain();
  if (chain === 'sui') return isValidSuiAddress(address);
  if (isEvmChain(chain)) return isValidEvmAddress(address);
  return isValidSolanaAddress(address);
}

function getChainAddressLabel(): string {
  const chain = getActiveChain();
  if (chain === 'sui') return 'Sui';
  if (isEvmChain(chain)) return 'EVM';
  return 'Solana';
}

export function validateRecipients(recipients: RecipientConfig[]): {
  valid: boolean;
  totalPercent: number;
  errors: string[];
} {
  const errors: string[] = [];
  let totalPercent = 0;

  if (recipients.length === 0) {
    errors.push('Add at least one recipient');
    return { valid: false, totalPercent: 0, errors };
  }

  if (recipients.length > 10) {
    errors.push('Maximum 10 recipients allowed');
  }

  const seenAddresses = new Set<string>();
  const chainLabel = getChainAddressLabel();

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];

    if (!r.address.trim()) {
      errors.push(`Recipient ${i + 1}: address is required`);
    } else if (!isValidAddressForChain(r.address.trim())) {
      errors.push(`Recipient ${i + 1}: invalid ${chainLabel} address`);
    } else if (seenAddresses.has(r.address.trim().toLowerCase())) {
      errors.push(`Recipient ${i + 1}: duplicate address`);
    } else {
      seenAddresses.add(r.address.trim().toLowerCase());
    }

    if (r.percentage <= 0 || r.percentage > 100) {
      errors.push(`Recipient ${i + 1}: percentage must be between 0.01 and 100`);
    }

    totalPercent += r.percentage;
  }

  const roundedTotal = Math.round(totalPercent * 100) / 100;
  if (roundedTotal !== 100) {
    errors.push(`Percentages must sum to 100% (currently ${roundedTotal}%)`);
  }

  return {
    valid: errors.length === 0,
    totalPercent: roundedTotal,
    errors,
  };
}
