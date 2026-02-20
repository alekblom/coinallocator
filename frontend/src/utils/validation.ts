import type { RecipientConfig } from '../types';

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function isValidSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
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

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];

    if (!r.address.trim()) {
      errors.push(`Recipient ${i + 1}: address is required`);
    } else if (!isValidSolanaAddress(r.address.trim())) {
      errors.push(`Recipient ${i + 1}: invalid Solana address`);
    } else if (seenAddresses.has(r.address.trim())) {
      errors.push(`Recipient ${i + 1}: duplicate address`);
    } else {
      seenAddresses.add(r.address.trim());
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
