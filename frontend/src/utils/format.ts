export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

export function formatSolFromSol(sol: number): string {
  return sol.toFixed(4);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Format a raw amount given the chain's native decimals.
 * SOL/SUI: 9 decimals (lamports/MIST), EVM: 18 decimals (wei).
 */
export function formatNativeAmount(raw: number, decimals: number): string {
  return (raw / Math.pow(10, decimals)).toFixed(4);
}
