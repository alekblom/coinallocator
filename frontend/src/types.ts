export interface RecipientConfig {
  id: string;
  address: string;
  percentage: number;
  label?: string;
}

export interface DeployedSplit {
  address: string;
  name: string;
  authority: string;
  recipients: {
    wallet: string;
    shareBps: number;
    claimedSol: number;
  }[];
  balance: number;
  totalReceived: number;
  createdAt: number;
}

export type ChainId = 'solana' | 'sui' | 'ethereum' | 'base' | 'polygon';

export interface AppState {
  wallet: {
    chain: ChainId;
    connected: boolean;
    publicKey: string | null;
    walletName: string | null;
    balance: number | null;
  };
  split: {
    name: string;
    recipients: RecipientConfig[];
  };
  deploy: {
    step: 'preview' | 'payment' | 'deploying' | 'done' | 'error';
    paymentComplete: boolean;
    txSignature: string | null;
    splitAddress: string | null;
    error: string | null;
  };
  dashboard: {
    splits: DeployedSplit[];
    loading: boolean;
  };
}
