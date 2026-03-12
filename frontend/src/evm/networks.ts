import type { ChainId } from '../types';

export interface EvmNetworkConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  factoryAddress: string;
}

// Testnet factory addresses — replace after deployment
const SEPOLIA_FACTORY = '0x0000000000000000000000000000000000000000';
const BASE_SEPOLIA_FACTORY = '0x0000000000000000000000000000000000000000';
const POLYGON_AMOY_FACTORY = '0x0000000000000000000000000000000000000000';

export const EVM_NETWORKS: Record<string, EvmNetworkConfig> = {
  ethereum: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
    factoryAddress: SEPOLIA_FACTORY,
  },
  base: {
    chainId: 84532,
    chainIdHex: '0x14a34',
    chainName: 'Base Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
    factoryAddress: BASE_SEPOLIA_FACTORY,
  },
  polygon: {
    chainId: 80002,
    chainIdHex: '0x13882',
    chainName: 'Polygon Amoy',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
    factoryAddress: POLYGON_AMOY_FACTORY,
  },
};

export function getEvmNetwork(chain: ChainId): EvmNetworkConfig {
  const net = EVM_NETWORKS[chain];
  if (!net) throw new Error(`Not an EVM chain: ${chain}`);
  return net;
}

export function isEvmChain(chain: ChainId): boolean {
  return chain === 'ethereum' || chain === 'base' || chain === 'polygon';
}
