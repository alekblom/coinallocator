// Stub IDL - will be replaced with generated IDL after `anchor build`
export const IDL = {
  version: '0.1.0',
  name: 'coin_allocator',
  instructions: [
    {
      name: 'createSplit',
      accounts: [
        { name: 'split', isMut: true, isSigner: false },
        { name: 'creator', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'name', type: { array: ['u8', 32] } },
        {
          name: 'recipients',
          type: { vec: { defined: 'RecipientInput' } },
        },
      ],
    },
    {
      name: 'distribute',
      accounts: [
        { name: 'split', isMut: true, isSigner: false },
        { name: 'payer', isMut: true, isSigner: true },
      ],
      args: [],
    },
    {
      name: 'claim',
      accounts: [
        { name: 'split', isMut: true, isSigner: false },
        { name: 'recipient', isMut: true, isSigner: true },
      ],
      args: [],
    },
    {
      name: 'closeSplit',
      accounts: [
        { name: 'split', isMut: true, isSigner: false },
        { name: 'creator', isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'Split',
      type: {
        kind: 'struct' as const,
        fields: [
          { name: 'creator', type: 'publicKey' },
          { name: 'name', type: { array: ['u8', 32] } },
          { name: 'bump', type: 'u8' },
          { name: 'totalReceivedSol', type: 'u64' },
          { name: 'recipientCount', type: 'u8' },
          { name: 'recipients', type: { vec: { defined: 'Recipient' } } },
          { name: 'createdAt', type: 'i64' },
          { name: 'updatedAt', type: 'i64' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'RecipientInput',
      type: {
        kind: 'struct' as const,
        fields: [
          { name: 'wallet', type: 'publicKey' },
          { name: 'shareBps', type: 'u16' },
        ],
      },
    },
    {
      name: 'Recipient',
      type: {
        kind: 'struct' as const,
        fields: [
          { name: 'wallet', type: 'publicKey' },
          { name: 'shareBps', type: 'u16' },
          { name: 'claimedSol', type: 'u64' },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'SharesNotFullyAllocated', msg: 'Recipient shares must sum to exactly 10000 basis points' },
    { code: 6001, name: 'TooManyRecipients', msg: 'Too many recipients, maximum is 10' },
    { code: 6002, name: 'NoRecipients', msg: 'Must have at least one recipient' },
    { code: 6003, name: 'InvalidShareBps', msg: 'Individual share must be between 1 and 10000 basis points' },
    { code: 6004, name: 'DuplicateRecipient', msg: 'Duplicate recipient wallet address' },
    { code: 6005, name: 'RecipientNotFound', msg: 'Recipient not found in this split' },
    { code: 6006, name: 'NothingToClaim', msg: 'Nothing to claim' },
    { code: 6007, name: 'InsufficientFunds', msg: 'Insufficient funds in vault' },
    { code: 6008, name: 'Unauthorized', msg: 'Only the split creator can perform this action' },
    { code: 6009, name: 'EmptyName', msg: 'Split name must not be empty' },
    { code: 6010, name: 'ArithmeticOverflow', msg: 'Arithmetic overflow' },
    { code: 6011, name: 'RemainingAccountsMismatch', msg: 'Remaining accounts do not match recipients' },
  ],
};

export type CoinAllocatorIDL = typeof IDL;
