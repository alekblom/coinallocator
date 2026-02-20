use anchor_lang::prelude::*;
use crate::error::CoinAllocatorError;
use crate::state::Split;

#[derive(Accounts)]
pub struct CloseSplit<'info> {
    #[account(
        mut,
        seeds = [b"split", split.creator.as_ref(), split.name.as_ref()],
        bump = split.bump,
        has_one = creator @ CoinAllocatorError::Unauthorized,
        close = creator,
    )]
    pub split: Account<'info, Split>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

pub fn handler(ctx: Context<CloseSplit>) -> Result<()> {
    msg!("Split closed by creator {}", ctx.accounts.creator.key());
    Ok(())
}
