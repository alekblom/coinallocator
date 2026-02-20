use anchor_lang::prelude::*;
use crate::error::CoinAllocatorError;
use crate::state::Split;

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"split", split.creator.as_ref(), split.name.as_ref()],
        bump = split.bump,
    )]
    pub split: Account<'info, Split>,

    #[account(mut)]
    pub recipient: Signer<'info>,
}

pub fn handler(ctx: Context<Claim>) -> Result<()> {
    let split = &mut ctx.accounts.split;
    let recipient_key = ctx.accounts.recipient.key();

    // Find the recipient
    let idx = split
        .recipients
        .iter()
        .position(|r| r.wallet == recipient_key)
        .ok_or(CoinAllocatorError::RecipientNotFound)?;

    // Calculate total ever received
    let rent = Rent::get()?;
    let rent_exempt = rent.minimum_balance(split.to_account_info().data_len());
    let current_lamports = split.to_account_info().lamports();

    let total_claimed: u64 = split
        .recipients
        .iter()
        .map(|r| r.claimed_sol)
        .try_fold(0u64, |acc, x| acc.checked_add(x))
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?;

    let total_ever_received = current_lamports
        .checked_add(total_claimed)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?
        .checked_sub(rent_exempt)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?;

    // Calculate this recipient's entitlement using u128 to prevent overflow
    let entitlement = (total_ever_received as u128)
        .checked_mul(split.recipients[idx].share_bps as u128)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?
        .checked_div(10_000u128)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)? as u64;

    let claimable = entitlement
        .checked_sub(split.recipients[idx].claimed_sol)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?;

    require!(claimable > 0, CoinAllocatorError::NothingToClaim);

    // Ensure we don't go below rent-exempt
    let available = current_lamports
        .checked_sub(rent_exempt)
        .ok_or(CoinAllocatorError::InsufficientFunds)?;
    let transfer_amount = claimable.min(available);
    require!(transfer_amount > 0, CoinAllocatorError::NothingToClaim);

    // Direct lamport manipulation (program-owned account)
    **split.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // Update claimed amount
    split.recipients[idx].claimed_sol = split.recipients[idx]
        .claimed_sol
        .checked_add(transfer_amount)
        .ok_or(CoinAllocatorError::ArithmeticOverflow)?;

    msg!(
        "Claimed {} lamports for recipient {}",
        transfer_amount,
        recipient_key
    );
    Ok(())
}
