export interface RecipientConfig {
  id: string;
  address: string;
  percentage: number;
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

export interface AppState {
  wallet: {
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
