import { BrowserProvider, JsonRpcSigner } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import type { ChainWalletInfo } from './types';
import type { ChainId } from '../types';
import { store } from '../state';
import { showToast } from '../components/toast';
import { getEvmNetwork, isEvmChain } from '../evm/networks';

// EIP-6963 types
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: Eip1193Provider;
}

interface EIP6963AnnounceEvent extends Event {
  detail: EIP6963ProviderDetail;
}

// Detected EVM wallets
const detectedWallets: Map<string, EIP6963ProviderDetail> = new Map();
let eip6963Initialized = false;

let activeSigner: JsonRpcSigner | null = null;
let activeProvider: BrowserProvider | null = null;

/**
 * Listen for EIP-6963 wallet announcements.
 */
export function initEvmWallet(): void {
  if (eip6963Initialized) return;
  eip6963Initialized = true;

  window.addEventListener('eip6963:announceProvider', (event: Event) => {
    const e = event as EIP6963AnnounceEvent;
    detectedWallets.set(e.detail.info.uuid, e.detail);
  });

  // Request providers to announce themselves
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

/**
 * Get available EVM wallets for the given chain.
 */
export function getEvmAvailableWallets(chain: ChainId): ChainWalletInfo[] {
  const wallets: ChainWalletInfo[] = [];

  // EIP-6963 wallets
  for (const [, detail] of detectedWallets) {
    wallets.push({
      name: detail.info.name,
      icon: detail.info.icon,
      detected: true,
      chain,
    });
  }

  // Fallback: window.ethereum if no EIP-6963 wallets found
  if (wallets.length === 0 && typeof window !== 'undefined' && (window as any).ethereum) {
    wallets.push({
      name: 'Browser Wallet',
      icon: '',
      detected: true,
      chain,
    });
  }

  return wallets;
}

/**
 * Connect to an EVM wallet and switch to the correct chain.
 */
export async function connectEvmWallet(walletName: string, chain: ChainId): Promise<void> {
  if (!isEvmChain(chain)) throw new Error(`Not an EVM chain: ${chain}`);

  let ethProvider: Eip1193Provider | null = null;

  // Find EIP-6963 wallet by name
  for (const [, detail] of detectedWallets) {
    if (detail.info.name === walletName) {
      ethProvider = detail.provider;
      break;
    }
  }

  // Fallback to window.ethereum
  if (!ethProvider && (window as any).ethereum) {
    ethProvider = (window as any).ethereum;
  }

  if (!ethProvider) {
    showToast('EVM wallet not found', 'error');
    return;
  }

  try {
    activeProvider = new BrowserProvider(ethProvider);

    // Request accounts
    await activeProvider.send('eth_requestAccounts', []);

    // Switch/add chain
    await ensureCorrectChain(chain, ethProvider);

    // Re-create provider after chain switch
    activeProvider = new BrowserProvider(ethProvider);
    activeSigner = await activeProvider.getSigner();

    const address = await activeSigner.getAddress();

    store.update('wallet', {
      connected: true,
      publicKey: address,
      walletName,
    });

    await refreshEvmBalance();
    showToast(`Connected to ${walletName}`, 'success');

    // Listen for account/chain changes
    if ((ethProvider as any).on) {
      (ethProvider as any).on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectEvmWallet();
        } else {
          store.update('wallet', { publicKey: accounts[0] });
          refreshEvmBalance();
        }
      });

      (ethProvider as any).on('chainChanged', () => {
        refreshEvmBalance();
      });
    }
  } catch (err: any) {
    showToast(err.message || 'Failed to connect EVM wallet', 'error');
  }
}

/**
 * Disconnect EVM wallet.
 */
export function disconnectEvmWallet(): void {
  activeSigner = null;
  activeProvider = null;
  store.update('wallet', {
    connected: false,
    publicKey: null,
    walletName: null,
    balance: null,
  });
}

/**
 * Refresh the native token balance.
 */
export async function refreshEvmBalance(): Promise<void> {
  const address = store.getState().wallet.publicKey;
  if (!address || !activeProvider) return;

  try {
    const balance = await activeProvider.getBalance(address);
    // Convert wei to whole units (18 decimals)
    store.update('wallet', { balance: Number(balance) / 1e18 });
  } catch {
    // silently fail
  }
}

/**
 * Get the active ethers signer.
 */
export function getEvmSigner(): JsonRpcSigner {
  if (!activeSigner) throw new Error('No EVM wallet connected');
  return activeSigner;
}

/**
 * Get the active ethers provider.
 */
export function getEvmProvider(): BrowserProvider {
  if (!activeProvider) throw new Error('No EVM provider');
  return activeProvider;
}

/**
 * Ensure the wallet is on the correct chain, switching if needed.
 */
async function ensureCorrectChain(chain: ChainId, ethProvider: Eip1193Provider): Promise<void> {
  const network = getEvmNetwork(chain);

  try {
    await (ethProvider as any).request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (switchError: any) {
    // Error code 4902 = chain not added yet
    if (switchError.code === 4902) {
      await (ethProvider as any).request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: network.chainIdHex,
          chainName: network.chainName,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: network.rpcUrls,
          blockExplorerUrls: network.blockExplorerUrls,
        }],
      });
    } else {
      throw switchError;
    }
  }
}
