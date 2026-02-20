use anchor_lang::prelude::*;
use crate::error::CoinAllocatorError;
use crate::state::{Recipient, RecipientInput, Split};

#[derive(Accounts)]
#[instruction(name: [u8; 32])]
pub struct CreateSplit<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Split::INIT_SPACE,
        seeds = [b"split", creator.key().as_ref(), name.as_ref()],
        bump,
    )]
    pub split: Account<'info, Split>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateSplit>,
    name: [u8; 32],
    recipients: Vec<RecipientInput>,
) -> Result<()> {
    require!(name.iter().any(|&b| b != 0), CoinAllocatorError::EmptyName);
    require!(!recipients.is_empty(), CoinAllocatorError::NoRecipients);
    require!(recipients.len() <= 10, CoinAllocatorError::TooManyRecipients);

    let mut total_bps: u32 = 0;
    for r in &recipients {
        require!(r.share_bps >= 1 && r.share_bps <= 10000, CoinAllocatorError::InvalidShareBps);
        total_bps += r.share_bps as u32;
    }
    require!(total_bps == 10000, CoinAllocatorError::SharesNotFullyAllocated);

    // Check for duplicate wallets
    for i in 0..recipients.len() {
        for j in (i + 1)..recipients.len() {
            require!(
                recipients[i].wallet != recipients[j].wallet,
                CoinAllocatorError::DuplicateRecipient
            );
        }
    }

    let split = &mut ctx.accounts.split;
    split.creator = ctx.accounts.creator.key();
    split.name = name;
    split.bump = ctx.bumps.split;
    split.total_received_sol = 0;
    split.recipient_count = recipients.len() as u8;
    split.recipients = recipients
        .iter()
        .map(|r| Recipient {
            wallet: r.wallet,
            share_bps: r.share_bps,
            claimed_sol: 0,
        })
        .collect();

    let clock = Clock::get()?;
    split.created_at = clock.unix_timestamp;
    split.updated_at = clock.unix_timestamp;

    msg!("Split created with {} recipients", split.recipient_count);
    Ok(())
}
