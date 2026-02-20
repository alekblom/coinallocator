import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { IDL } from './idl';
import { PROGRAM_ID } from '../constants';
import { getConnection, getActiveAdapter } from '../wallet/adapter';
import { deriveSplitPDA, nameToBytes } from './pda';
import { percentToBps } from '../utils/format';
import type { RecipientConfig } from '../types';

function getProgram(): Program {
  const connection = getConnection();
  const adapter = getActiveAdapter();
  if (!adapter || !adapter.publicKey) throw new Error('Wallet not connected');

  const provider = new AnchorProvider(
    connection,
    adapter as any,
    { commitment: 'confirmed' },
  );

  return new Program(IDL as any, provider);
}

export async function buildCreateSplitTx(
  creator: PublicKey,
  name: string,
  recipients: RecipientConfig[],
): Promise<{ tx: Transaction; splitAddress: PublicKey }> {
  const program = getProgram();
  const nameBytes = nameToBytes(name);
  const [splitPda] = deriveSplitPDA(creator, nameBytes);

  const recipientInputs = recipients.map(r => ({
    wallet: new PublicKey(r.address),
    shareBps: percentToBps(r.percentage),
  }));

  const ix = await program.methods
    .createSplit(Array.from(nameBytes), recipientInputs)
    .accounts({
      split: splitPda,
      creator: creator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);

  return { tx, splitAddress: splitPda };
}

export async function buildDistributeTx(
  splitAddress: PublicKey,
  payer: PublicKey,
  recipientWallets: PublicKey[],
): Promise<Transaction> {
  const program = getProgram();

  const ix = await program.methods
    .distribute()
    .accounts({
      split: splitAddress,
      payer: payer,
    })
    .remainingAccounts(
      recipientWallets.map(wallet => ({
        pubkey: wallet,
        isSigner: false,
        isWritable: true,
      })),
    )
    .instruction();

  return new Transaction().add(ix);
}

export async function buildClaimTx(
  splitAddress: PublicKey,
  recipient: PublicKey,
): Promise<Transaction> {
  const program = getProgram();

  const ix = await program.methods
    .claim()
    .accounts({
      split: splitAddress,
      recipient: recipient,
    })
    .instruction();

  return new Transaction().add(ix);
}

export async function fetchUserSplits(authority: PublicKey): Promise<any[]> {
  const program = getProgram();
  const connection = getConnection();

  const accounts = await connection.getProgramAccounts(
    new PublicKey(PROGRAM_ID),
    {
      filters: [
        { dataSize: 522 },
        {
          memcmp: {
            offset: 8, // after discriminator
            bytes: authority.toBase58(),
          },
        },
      ],
    },
  );

  return accounts.map(({ pubkey, account }) => {
    try {
      const decoded = program.coder.accounts.decode('Split', account.data);
      return {
        address: pubkey.toBase58(),
        data: decoded,
        lamports: account.lamports,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
}
