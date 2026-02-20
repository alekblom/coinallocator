use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("JALpaNuxgC39mZ2ct8Dg5w586k7TytktvXgHk4ixTxEg");

#[program]
pub mod coin_allocator {
    use super::*;

    pub fn create_split(
        ctx: Context<CreateSplit>,
        name: [u8; 32],
        recipients: Vec<state::RecipientInput>,
    ) -> Result<()> {
        instructions::create_split::handler(ctx, name, recipients)
    }

    pub fn distribute<'info>(
        ctx: Context<'_, '_, 'info, 'info, Distribute<'info>>,
    ) -> Result<()> {
        instructions::distribute::handler(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    pub fn close_split(ctx: Context<CloseSplit>) -> Result<()> {
        instructions::close_split::handler(ctx)
    }
}
