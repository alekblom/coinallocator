import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { getWallets } from '@wallet-standard/core';
import { isWalletWithRequiredFeatureSet, SUI_TESTNET_CHAIN, signAndExecuteTransaction } from '@mysten/wallet-standard';
import type { Wallet, WalletAccount } from '@wallet-standard/core';
import type { ChainWalletInfo } from './types';
import { store } from '../state';
import { showToast } from '../components/toast';
import { SUI_RPC_URL } from '../constants';
import type { Transaction } from '@mysten/sui/transactions';

let suiClient: SuiClient | null = null;
let activeWallet: Wallet | null = null;
let activeAccount: WalletAccount | null = null;

export function getSuiClient(): SuiClient {
  if (!suiClient) {
    suiClient = new SuiClient({ url: SUI_RPC_URL });
  }
  return suiClient;
}

function getSuiWallets(): Wallet[] {
  const { get } = getWallets();
  return get().filter(w =>
    isWalletWithRequiredFeatureSet(w) &&
    w.chains.some(c => c.startsWith('sui:'))
  );
}

export function initSuiWallet(): void {
  // Sui wallets register themselves via the wallet-standard
  // No explicit initialization needed — they're detected on demand
}

export function getSuiAvailableWallets(): ChainWalletInfo[] {
  return getSuiWallets().map(w => ({
    name: w.name,
    icon: typeof w.icon === 'string' ? w.icon : '',
    detected: true, // if we can see it, it's installed
    chain: 'sui' as const,
  }));
}

export async function connectSuiWallet(walletName: string): Promise<void> {
  const wallets = getSuiWallets();
  const wallet = wallets.find(w => w.name === walletName);
  if (!wallet) {
    showToast('Sui wallet not found', 'error');
    return;
  }

  try {
    const connectFeature = wallet.features['standard:connect'];
    const { accounts } = await (connectFeature as any).connect();

    if (!accounts.length) {
      showToast('No accounts found', 'error');
      return;
    }

    activeWallet = wallet;
    activeAccount = accounts[0];

    store.update('wallet', {
      connected: true,
      publicKey: activeAccount!.address,
      walletName: wallet.name,
    });

    await refreshSuiBalance();
    showToast(`Connected to ${wallet.name}`, 'success');

    // Listen for disconnect
    if (wallet.features['standard:events']) {
      (wallet.features['standard:events'] as any).on('change', () => {
        const currentAccounts = wallet.accounts;
        if (!currentAccounts.length) {
          disconnectSuiWallet();
        }
      });
    }
  } catch (err: any) {
    showToast(err.message || 'Failed to connect Sui wallet', 'error');
  }
}

export async function disconnectSuiWallet(): Promise<void> {
  if (activeWallet?.features['standard:disconnect']) {
    try {
      await (activeWallet.features['standard:disconnect'] as any).disconnect();
    } catch {
      // ignore
    }
  }
  activeWallet = null;
  activeAccount = null;
  store.update('wallet', {
    connected: false,
    publicKey: null,
    walletName: null,
    balance: null,
  });
}

export async function refreshSuiBalance(): Promise<void> {
  const address = store.getState().wallet.publicKey;
  if (!address) return;

  try {
    const client = getSuiClient();
    const { totalBalance } = await client.getBalance({ owner: address });
    // SUI has 9 decimal places (MIST), same as SOL (lamports)
    store.update('wallet', { balance: Number(totalBalance) / 1e9 });
  } catch {
    // silently fail
  }
}

export async function signAndSendSuiTransaction(tx: Transaction): Promise<string> {
  if (!activeWallet || !activeAccount) throw new Error('No Sui wallet connected');

  const result = await signAndExecuteTransaction(activeWallet, {
    transaction: tx,
    account: activeAccount,
    chain: SUI_TESTNET_CHAIN,
  });

  return result.digest;
}

export function getActiveSuiWallet(): Wallet | null {
  return activeWallet;
}

export function getActiveSuiAccount(): WalletAccount | null {
  return activeAccount;
}
