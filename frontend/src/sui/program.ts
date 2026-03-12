import { Transaction } from '@mysten/sui/transactions';
import { SUI_PACKAGE_ID } from '../constants';
import { getSuiClient } from '../chain/sui';
import type { DeployedSplit } from '../types';

export function buildCreateSplitTx(
  name: string,
  wallets: string[],
  shares: number[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::split::create_split`,
    arguments: [
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(name))),
      tx.pure.vector('address', wallets),
      tx.pure.vector('u64', shares),
    ],
  });
  return tx;
}

export function buildDepositTx(
  splitObjectId: string,
  amountMist: number,
): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::split::deposit`,
    arguments: [
      tx.object(splitObjectId),
      coin,
    ],
  });
  return tx;
}

export function buildDistributeTx(splitObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::split::distribute`,
    arguments: [tx.object(splitObjectId)],
  });
  return tx;
}

export function buildClaimTx(splitObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SUI_PACKAGE_ID}::split::claim`,
    arguments: [tx.object(splitObjectId)],
  });
  return tx;
}

export async function fetchUserSplits(owner: string): Promise<DeployedSplit[]> {
  const client = getSuiClient();

  // Query SplitCreated events to find splits by this creator
  const events = await client.queryEvents({
    query: {
      MoveEventType: `${SUI_PACKAGE_ID}::split::SplitCreated`,
    },
    limit: 50,
  });

  // Filter by creator
  const creatorSplits = events.data.filter((e: any) => {
    const parsed = e.parsedJson as any;
    return parsed?.creator === owner;
  });

  if (creatorSplits.length === 0) return [];

  // Fetch object data for each split
  const objectIds = creatorSplits.map((e: any) => (e.parsedJson as any).split_id);
  const objects = await client.multiGetObjects({
    ids: objectIds,
    options: { showContent: true },
  });

  return objects
    .filter((obj: any) => obj.data?.content)
    .map((obj: any) => {
      const fields = obj.data.content.fields;
      const recipients = (fields.recipients || []).map((r: any) => ({
        wallet: r.fields.wallet,
        shareBps: Number(r.fields.share_bps),
        claimedSol: Number(r.fields.claimed),
      }));

      return {
        address: obj.data.objectId,
        name: decodeBytes(fields.name),
        authority: fields.creator,
        recipients,
        balance: Number(fields.vault),
        totalReceived: Number(fields.total_received),
        createdAt: Number(fields.created_at),
      };
    });
}

function decodeBytes(bytes: number[] | string): string {
  if (typeof bytes === 'string') return bytes;
  return new TextDecoder().decode(new Uint8Array(bytes));
}
