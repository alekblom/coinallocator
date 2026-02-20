use anchor_lang::prelude::*;

#[error_code]
pub enum CoinAllocatorError {
    #[msg("Recipient shares must sum to exactly 10000 basis points")]
    SharesNotFullyAllocated,

    #[msg("Too many recipients, maximum is 10")]
    TooManyRecipients,

    #[msg("Must have at least one recipient")]
    NoRecipients,

    #[msg("Individual share must be between 1 and 10000 basis points")]
    InvalidShareBps,

    #[msg("Duplicate recipient wallet address")]
    DuplicateRecipient,

    #[msg("Recipient not found in this split")]
    RecipientNotFound,

    #[msg("Nothing to claim")]
    NothingToClaim,

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,

    #[msg("Only the split creator can perform this action")]
    Unauthorized,

    #[msg("Split name must not be empty")]
    EmptyName,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Remaining accounts do not match recipients")]
    RemainingAccountsMismatch,
}
