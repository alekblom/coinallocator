import { Contract, parseEther, formatEther } from 'ethers';
import { getEvmSigner, getEvmProvider } from '../chain/evm';
import { getEvmNetwork } from './networks';
import { FACTORY_ABI, SPLIT_ABI } from './abi';
import { getActiveChain } from '../chain/manager';
import type { DeployedSplit } from '../types';

function getFactory() {
  const chain = getActiveChain();
  const network = getEvmNetwork(chain);
  return new Contract(network.factoryAddress, FACTORY_ABI, getEvmSigner());
}

/**
 * Deploy a new split via the factory.
 */
export async function createSplit(
  name: string,
  wallets: string[],
  shares: number[],
): Promise<{ txHash: string; splitAddress: string }> {
  const chain = getActiveChain();
  const network = getEvmNetwork(chain);
  const factory = getFactory();

  // Predict address first
  const signer = getEvmSigner();
  const creator = await signer.getAddress();
  const predictedAddress = await factory.predictAddress(creator, name);

  const tx = await factory.createSplit(name, wallets, shares);
  const receipt = await tx.wait();

  // Try to get the split address from events
  let splitAddress = predictedAddress;
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'SplitCreated') {
        splitAddress = parsed.args.splitAddress;
        break;
      }
    } catch {
      // not a factory log
    }
  }

  return { txHash: receipt.hash, splitAddress };
}

/**
 * Push-distribute all balance to recipients.
 */
export async function distribute(splitAddress: string): Promise<string> {
  const split = new Contract(splitAddress, SPLIT_ABI, getEvmSigner());
  const tx = await split.distribute();
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Pull-claim msg.sender's share.
 */
export async function claim(splitAddress: string): Promise<string> {
  const split = new Contract(splitAddress, SPLIT_ABI, getEvmSigner());
  const tx = await split.claim();
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Send native token to a split address.
 */
export async function sendToSplit(splitAddress: string, amountEth: string): Promise<string> {
  const signer = getEvmSigner();
  const tx = await signer.sendTransaction({
    to: splitAddress,
    value: parseEther(amountEth),
  });
  const receipt = await tx.wait();
  return receipt!.hash;
}

/**
 * Fetch splits created by a user by querying SplitCreated events.
 */
export async function fetchUserSplits(creator: string): Promise<DeployedSplit[]> {
  const chain = getActiveChain();
  const network = getEvmNetwork(chain);
  const provider = getEvmProvider();

  const factory = new Contract(network.factoryAddress, FACTORY_ABI, provider);
  const filter = factory.filters.SplitCreated(null, creator);

  // Query from the last ~50k blocks (roughly a few days on testnets)
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50000);
  const events = await factory.queryFilter(filter, fromBlock);

  const splits: DeployedSplit[] = [];

  for (const event of events) {
    const parsed = factory.interface.parseLog({ topics: [...event.topics], data: event.data });
    if (!parsed) continue;

    const splitAddress = parsed.args.splitAddress;
    try {
      const split = await fetchSplitByAddress(splitAddress);
      splits.push(split);
    } catch {
      // skip invalid splits
    }
  }

  return splits;
}

/**
 * Read split contract state.
 */
export async function fetchSplitByAddress(address: string): Promise<DeployedSplit> {
  const provider = getEvmProvider();
  const split = new Contract(address, SPLIT_ABI, provider);

  const [name, creator, totalReceived, createdAt, recipientData, balance] = await Promise.all([
    split.name(),
    split.creator(),
    split.totalReceived(),
    split.createdAt(),
    split.getAllRecipients(),
    provider.getBalance(address),
  ]);

  const [wallets, shares, claimed] = recipientData;

  const recipients = wallets.map((wallet: string, i: number) => ({
    wallet,
    shareBps: Number(shares[i]),
    claimedSol: Number(claimed[i]), // keep field name for compat, value is in wei
  }));

  return {
    address,
    name,
    authority: creator,
    recipients,
    balance: Number(balance), // in wei
    totalReceived: Number(totalReceived), // in wei
    createdAt: Number(createdAt),
  };
}
