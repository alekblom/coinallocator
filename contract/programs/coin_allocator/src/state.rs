use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecipientInput {
    pub wallet: Pubkey,
    pub share_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Recipient {
    pub wallet: Pubkey,
    pub share_bps: u16,
    pub claimed_sol: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Split {
    pub creator: Pubkey,
    pub name: [u8; 32],
    pub bump: u8,
    pub total_received_sol: u64,
    pub recipient_count: u8,
    #[max_len(10)]
    pub recipients: Vec<Recipient>,
    pub created_at: i64,
    pub updated_at: i64,
}
