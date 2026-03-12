import { getActiveChain, getNativeExplorerUrl } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import { EXPLORER_URL, SOLANA_NETWORK, SUI_EXPLORER_URL } from '../constants';

export interface TxHistoryEntry {
  signature: string;
  timestamp: number;
  type: 'deposit' | 'distribute' | 'claim' | 'unknown';
  amount?: number;
  explorerUrl: string;
}

export async function fetchTxHistory(splitAddress: string, limit = 20): Promise<TxHistoryEntry[]> {
  const chain = getActiveChain();

  if (chain === 'sui') {
    return fetchSuiHistory(splitAddress, limit);
  } else if (isEvmChain(chain)) {
    return fetchEvmHistory(splitAddress, limit);
  } else {
    return fetchSolanaHistory(splitAddress, limit);
  }
}

async function fetchSolanaHistory(address: string, limit: number): Promise<TxHistoryEntry[]> {
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const { SOLANA_RPC_URL } = await import('../constants');

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const pubkey = new PublicKey(address);

  const signatures = await connection.getSignaturesForAddress(pubkey, { limit });
  if (signatures.length === 0) return [];

  const txs = await connection.getParsedTransactions(
    signatures.map(s => s.signature),
    { maxSupportedTransactionVersion: 0 },
  );

  return signatures.map((sig, i) => {
    const tx = txs[i];
    let type: TxHistoryEntry['type'] = 'unknown';
    let amount: number | undefined;

    if (tx?.meta?.logMessages) {
      const logs = tx.meta.logMessages;
      const logStr = logs.join(' ');

      if (logStr.includes('Instruction: Distribute')) {
        type = 'distribute';
      } else if (logStr.includes('Instruction: Claim')) {
        type = 'claim';
      } else if (logStr.includes('Transfer')) {
        type = 'deposit';
      }
    }

    // Try to get amount from balance changes
    if (tx?.meta && type === 'deposit') {
      const preBalance = tx.meta.preBalances;
      const postBalance = tx.meta.postBalances;
      const accountKeys = tx.transaction.message.accountKeys;
      const splitIdx = accountKeys.findIndex(
        (k: any) => (typeof k === 'string' ? k : k.pubkey?.toBase58?.() || k.pubkey) === address,
      );
      if (splitIdx >= 0 && preBalance && postBalance) {
        const diff = postBalance[splitIdx] - preBalance[splitIdx];
        if (diff > 0) amount = diff;
      }
    }

    return {
      signature: sig.signature,
      timestamp: sig.blockTime || 0,
      type,
      amount,
      explorerUrl: `${EXPLORER_URL}/tx/${sig.signature}?cluster=${SOLANA_NETWORK}`,
    };
  });
}

async function fetchSuiHistory(objectId: string, limit: number): Promise<TxHistoryEntry[]> {
  const { getSuiClient } = await import('../chain/sui');
  const client = getSuiClient();

  const result = await client.queryTransactionBlocks({
    filter: { InputObject: objectId },
    options: { showEvents: true, showBalanceChanges: true },
    limit,
    order: 'descending',
  });

  return result.data.map(tx => {
    let type: TxHistoryEntry['type'] = 'unknown';
    let amount: number | undefined;

    if (tx.events) {
      for (const event of tx.events) {
        const eventType = event.type.toLowerCase();
        if (eventType.includes('distribute')) { type = 'distribute'; break; }
        if (eventType.includes('claim')) { type = 'claim'; break; }
        if (eventType.includes('deposit')) { type = 'deposit'; break; }
      }
    }

    if (type === 'unknown' && tx.balanceChanges) {
      const incoming = tx.balanceChanges.find(
        (bc: any) => bc.owner?.AddressOwner === objectId && Number(bc.amount) > 0,
      );
      if (incoming) {
        type = 'deposit';
        amount = Number(incoming.amount);
      }
    }

    return {
      signature: tx.digest,
      timestamp: tx.timestampMs ? Math.floor(Number(tx.timestampMs) / 1000) : 0,
      type,
      amount,
      explorerUrl: `${SUI_EXPLORER_URL}/tx/${tx.digest}`,
    };
  });
}

async function fetchEvmHistory(splitAddress: string, limit: number): Promise<TxHistoryEntry[]> {
  const { Contract } = await import('ethers');
  const { getEvmProvider } = await import('../chain/evm');
  const { SPLIT_ABI } = await import('../evm/abi');

  const explorerBase = getNativeExplorerUrl();

  try {
    const provider = getEvmProvider();
    const split = new Contract(splitAddress, SPLIT_ABI, provider);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 50000);

    // Query all split events
    const [distributedEvents, claimedEvents] = await Promise.all([
      split.queryFilter(split.filters.Distributed(), fromBlock),
      split.queryFilter(split.filters.Claimed(), fromBlock),
    ]);

    const entries: TxHistoryEntry[] = [];

    for (const event of distributedEvents) {
      const block = await event.getBlock();
      const parsed = split.interface.parseLog({ topics: [...event.topics], data: event.data });
      entries.push({
        signature: event.transactionHash,
        timestamp: block?.timestamp || 0,
        type: 'distribute',
        amount: parsed ? Number(parsed.args.amount) : undefined,
        explorerUrl: `${explorerBase}/tx/${event.transactionHash}`,
      });
    }

    for (const event of claimedEvents) {
      const block = await event.getBlock();
      const parsed = split.interface.parseLog({ topics: [...event.topics], data: event.data });
      entries.push({
        signature: event.transactionHash,
        timestamp: block?.timestamp || 0,
        type: 'claim',
        amount: parsed ? Number(parsed.args.amount) : undefined,
        explorerUrl: `${explorerBase}/tx/${event.transactionHash}`,
      });
    }

    // Sort by timestamp descending and limit
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}
