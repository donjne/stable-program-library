use super::*;

#[error_code]
pub enum StablecoinError {
    #[msg("An assertion failed")]
    AssertFailed,
    #[msg("Invalid yield distribution. Must sum to 100%")]
    InvalidYieldDistribution,
    #[msg("Bump not found")]
    BumpNotFound,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Name is too long")]
    NameTooLong,
    #[msg("Symbol is too long")]
    SymbolTooLong,
    #[msg("URI is too long")]
    UriTooLong,
    #[msg("There has been an arithmetic overflow error")]
    ArithmeticOverflow,
    #[msg("Bond Rating is Invalid")]
    InvalidBondRating,
    #[msg("Fiat currency is wayyyy too long bruh relax")]
    FiatCurrencyTooLong,
    #[msg("The maximum bond mapping limit has been reached")]
    MaxBondMappingsReached,
    #[msg("No bond mapping found for the specified fiat currency")]
    NoBondMappingForCurrency,
    #[msg("Invalid fiat currency")]
    InvalidFiatCurrency,
    #[msg("The provided bond mint does not match the expected one for this currency")]
    InvalidBondMint,
}