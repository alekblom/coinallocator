import { getActiveChain } from '../chain/manager';
import { isEvmChain } from '../evm/networks';
import type { DeployedSplit } from '../types';

export async function fetchSplitByAddress(address: string): Promise<DeployedSplit> {
  const chain = getActiveChain();

  if (chain === 'sui') {
    return fetchSuiSplit(address);
  } else if (isEvmChain(chain)) {
    return fetchEvmSplit(address);
  } else {
    return fetchSolanaSplit(address);
  }
}

async function fetchSolanaSplit(address: string): Promise<DeployedSplit> {
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const { Program, AnchorProvider } = await import('@coral-xyz/anchor');
  const { IDL } = await import('../solana/idl');
  const { bytesToName } = await import('../solana/pda');
  const { SOLANA_RPC_URL } = await import('../constants');

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const pubkey = new PublicKey(address);

  const accountInfo = await connection.getAccountInfo(pubkey);
  if (!accountInfo) throw new Error('Split account not found');

  // Create a read-only provider (no wallet needed)
  const provider = new AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async (t: any) => t, signAllTransactions: async (t: any) => t } as any,
    { commitment: 'confirmed' },
  );

  const program = new Program(IDL as any, provider);
  const decoded = program.coder.accounts.decode('Split', accountInfo.data);
  const balance = await connection.getBalance(pubkey);

  return {
    address,
    name: bytesToName(decoded.name),
    authority: decoded.creator.toBase58(),
    recipients: decoded.recipients.map((r: any) => ({
      wallet: r.wallet.toBase58(),
      shareBps: r.shareBps,
      claimedSol: r.claimedSol.toNumber(),
    })),
    balance,
    totalReceived: decoded.totalReceivedSol?.toNumber?.() || 0,
    createdAt: decoded.createdAt?.toNumber?.() || 0,
  };
}

async function fetchSuiSplit(objectId: string): Promise<DeployedSplit> {
  const { getSuiClient } = await import('../chain/sui');
  const client = getSuiClient();

  const obj = await client.getObject({
    id: objectId,
    options: { showContent: true },
  });

  if (!obj.data?.content) throw new Error('Split object not found');
  const fields = (obj.data.content as any).fields;

  const recipients = (fields.recipients || []).map((r: any) => ({
    wallet: r.fields.wallet,
    shareBps: Number(r.fields.share_bps),
    claimedSol: Number(r.fields.claimed),
  }));

  const name = typeof fields.name === 'string'
    ? fields.name
    : new TextDecoder().decode(new Uint8Array(fields.name));

  return {
    address: objectId,
    name,
    authority: fields.creator,
    recipients,
    balance: Number(fields.vault),
    totalReceived: Number(fields.total_received),
    createdAt: Number(fields.created_at),
  };
}

async function fetchEvmSplit(address: string): Promise<DeployedSplit> {
  const { fetchSplitByAddress: evmFetch } = await import('../evm/program');
  return evmFetch(address);
}
