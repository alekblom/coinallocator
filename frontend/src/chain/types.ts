export type ChainId = 'solana' | 'sui' | 'ethereum' | 'base' | 'polygon';

export interface ChainWalletInfo {
  name: string;
  icon: string;
  detected: boolean;
  chain: ChainId;
}
