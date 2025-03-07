use super::*;

#[event]
pub struct FactoryInitializedEvent {
    pub authority: Pubkey,
    pub factory: Pubkey,
    pub min_fiat_reserve: u8,
    pub bond_reserve_multiplier: u8,
    pub yield_share_protocol: u8,
    pub yield_share_issuer: u8,
    pub yield_share_holders: u8,
    pub timestamp: i64,
}

#[event]
pub struct SovereignCoinInitializedEvent {
    pub authority: Pubkey,
    pub sovereign_coin: Pubkey,
    pub name: String,
    pub symbol: String,
    pub fiat_currency: String,
    pub bond_mint: Pubkey,
    pub bond_account: Pubkey,
    pub bond_rating: u8,
    pub decimals: u8,
    pub total_supply: u64,  
    pub required_reserve_percentage: u8, 
    pub fiat_amount: u64,
    pub bond_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct SovereignCoinSetupMintEvent {
    pub mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SovereignCoinTokenAccountsEvent {
    pub fiat_reserve: Pubkey,
    pub bond_holding: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SovereignCoinCreatedEvent {
    pub authority: Pubkey,
    pub sovereign_coin: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub fiat_currency: String,
    pub bond_mint: Pubkey,
    pub bond_account: Pubkey,
    pub bond_rating: u8,
    pub timestamp: i64,
}

#[event]
pub struct BondMappingRegisteredEvent {
    pub authority: Pubkey,
    pub factory: Pubkey,
    pub fiat_currency: String,
    pub bond_mint: Pubkey,
    pub bond_rating: u8,
    pub timestamp: i64,
}

