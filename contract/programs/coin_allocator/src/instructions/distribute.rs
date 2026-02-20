use anchor_lang::prelude::*;
use crate::error::CoinAllocatorError;
use crate::state::Split;

#[derive(Accounts)]
pub struct Distribute<'info> {
    #[account(
        mut,
        seeds = [b"split", split.creator.as_ref(), split.name.as_ref()],
        bump = split.bump,
    )]
    pub split: Account<'info, Split>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, Distribute<'info>>) -> Result<()> {
    let split = &ctx.accounts.split;
    let recipient_count = split.recipients.len();

    // Validate remaining accounts match recipients
    require!(
        ctx.remaining_accounts.len() == recipient_count,
        CoinAllocatorError::RemainingAccountsMismatch
    );

    // Verify each remaining account matches the corresponding recipient
    for (i, account) in ctx.remaining_accounts.iter().enumerate() {
        require!(
            account.key() == split.recipients[i].wallet,
            CoinAllocatorError::RemainingAccountsMismatch
        );
        require!(
            account.is_writable,
            CoinAllocatorError::RemainingAccountsMismatch
        );
    }

    // Calculate distributable amount
    let rent = Rent::get()?;
    let rent_exempt = rent.minimum_balance(split.to_account_info().data_len());
    let current_lamports = split.to_account_info().lamports();

    let distributable = current_lamports
        .checked_sub(rent_exempt)
        .ok_or(CoinAllocatorError::InsufficientFunds)?;

    require!(distributable > 0, CoinAllocatorError::NothingToClaim);

    // Calculate each recipient's share and transfer
    let split = &mut ctx.accounts.split;
    let mut total_distributed: u64 = 0;

    for (i, recipient_account) in ctx.remaining_accounts.iter().enumerate() {
        let share = (distributable as u128)
            .checked_mul(split.recipients[i].share_bps as u128)
            .ok_or(CoinAllocatorError::ArithmeticOverflow)?
            .checked_div(10_000u128)
            .ok_or(CoinAllocatorError::ArithmeticOverflow)? as u64;

        if share > 0 {
            **split.to_account_info().try_borrow_mut_lamports()? -= share;
            **recipient_account.try_borrow_mut_lamports()? += share;

            split.recipients[i].claimed_sol = split.recipients[i]
                .claimed_sol
                .checked_add(share)
                .ok_or(CoinAllocatorError::ArithmeticOverflow)?;

            total_distributed = total_distributed
                .checked_add(share)
                .ok_or(CoinAllocatorError::ArithmeticOverflow)?;
        }
    }

    msg!("Distributed {} lamports to {} recipients", total_distributed, recipient_count);
    Ok(())
}
