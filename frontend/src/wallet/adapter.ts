import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import type { BaseSignerWalletAdapter } from '@solana/wallet-adapter-base';
import { store } from '../state';
import { SOLANA_RPC_URL } from '../constants';
import { showToast } from '../components/toast';

interface WalletInfo {
  name: string;
  icon: string;
  adapter: BaseSignerWalletAdapter;
  detected: boolean;
}

let connection: Connection | null = null;
let adapters: BaseSignerWalletAdapter[] = [];
let activeAdapter: BaseSignerWalletAdapter | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  }
  return connection;
}

export function initWallet(): void {
  adapters = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];
}

export function getAvailableWallets(): WalletInfo[] {
  return adapters.map(adapter => ({
    name: adapter.name,
    icon: adapter.icon,
    adapter,
    detected: adapter.readyState === 'Installed',
  }));
}

export async function connectWallet(walletName: string): Promise<void> {
  const adapter = adapters.find(a => a.name === walletName);
  if (!adapter) {
    showToast('Wallet not found', 'error');
    return;
  }

  try {
    await adapter.connect();
    activeAdapter = adapter;

    const pubkey = adapter.publicKey!.toBase58();
    store.update('wallet', {
      connected: true,
      publicKey: pubkey,
      walletName: adapter.name,
    });

    await refreshBalance();
    showToast(`Connected to ${adapter.name}`, 'success');

    adapter.on('disconnect', () => {
      store.update('wallet', {
        connected: false,
        publicKey: null,
        walletName: null,
        balance: null,
      });
      activeAdapter = null;
      showToast('Wallet disconnected', 'info');
    });
  } catch (err: any) {
    showToast(err.message || 'Failed to connect', 'error');
  }
}

export async function disconnectWallet(): Promise<void> {
  if (activeAdapter) {
    await activeAdapter.disconnect();
    activeAdapter = null;
  }
  store.update('wallet', {
    connected: false,
    publicKey: null,
    walletName: null,
    balance: null,
  });
}

export async function refreshBalance(): Promise<void> {
  const pubkey = store.getState().wallet.publicKey;
  if (!pubkey) return;

  try {
    const conn = getConnection();
    const balance = await conn.getBalance(new PublicKey(pubkey));
    store.update('wallet', { balance: balance / 1e9 });
  } catch {
    // silently fail
  }
}

export async function signAndSendTransaction(
  tx: Transaction | VersionedTransaction,
): Promise<string> {
  if (!activeAdapter) throw new Error('No wallet connected');

  const conn = getConnection();

  if (tx instanceof Transaction) {
    tx.feePayer = activeAdapter.publicKey!;
    const { blockhash } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
  }

  const sig = await activeAdapter.sendTransaction(tx, conn);
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

export function getActiveAdapter(): BaseSignerWalletAdapter | null {
  return activeAdapter;
}
