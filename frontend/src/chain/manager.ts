import type { ChainId } from './types';
import { store } from '../state';
import { initWallet, disconnectWallet } from '../wallet/adapter';
import { initSuiWallet, disconnectSuiWallet } from './sui';
import { initEvmWallet, disconnectEvmWallet } from './evm';
import { isEvmChain } from '../evm/networks';

const CHAIN_STORAGE_KEY = 'activeChain';

const VALID_CHAINS: ChainId[] = ['solana', 'sui', 'ethereum', 'base', 'polygon'];

export function getActiveChain(): ChainId {
  return store.getState().wallet.chain;
}

export function setActiveChain(chain: ChainId): void {
  const current = getActiveChain();
  if (current === chain) return;

  // Disconnect current wallet
  if (store.getState().wallet.connected) {
    if (current === 'solana') {
      disconnectWallet();
    } else if (current === 'sui') {
      disconnectSuiWallet();
    } else if (isEvmChain(current)) {
      disconnectEvmWallet();
    }
  }

  store.update('wallet', {
    chain,
    connected: false,
    publicKey: null,
    walletName: null,
    balance: null,
  });

  localStorage.setItem(CHAIN_STORAGE_KEY, chain);
}

export function initChains(): void {
  // Restore saved chain preference
  const saved = localStorage.getItem(CHAIN_STORAGE_KEY) as ChainId | null;
  if (saved && VALID_CHAINS.includes(saved)) {
    store.update('wallet', { chain: saved });
  }

  initWallet();
  initSuiWallet();
  initEvmWallet();
}

export function getNativeToken(): string {
  const chain = getActiveChain();
  switch (chain) {
    case 'sui': return 'SUI';
    case 'polygon': return 'POL';
    case 'ethereum':
    case 'base':
      return 'ETH';
    default: return 'SOL';
  }
}

export function getNativeDecimals(): number {
  const chain = getActiveChain();
  if (chain === 'solana' || chain === 'sui') return 9;
  return 18; // EVM chains
}

export function getNativeExplorerUrl(): string {
  const chain = getActiveChain();
  switch (chain) {
    case 'sui': return 'https://suiscan.xyz/testnet';
    case 'ethereum': return 'https://sepolia.etherscan.io';
    case 'base': return 'https://sepolia.basescan.org';
    case 'polygon': return 'https://amoy.polygonscan.com';
    default: return 'https://explorer.solana.com';
  }
}
