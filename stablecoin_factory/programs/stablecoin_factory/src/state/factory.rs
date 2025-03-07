use super::*;


#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct BondCurrencyMapping {
    pub active: bool,
    pub fiat_currency: [u8; 8],      // Currency code (e.g., "USD", "MXN")
    pub bond_mint: Pubkey,           // The Stablebond token mint
    pub bond_rating: u8,             // Bond rating (1-10)
}


#[account]
#[derive(InitSpace)]
pub struct Factory {
    pub bump: u8,
    pub authority: Pubkey,  // Admin who can update certain parameters
    pub treasury: Pubkey,   // Treasury account to collect fees if any
    
    // Tracking metrics
    pub total_sovereign_coins: u64,  // Count of all sovereign coins created
    pub total_supply_all_coins: u128, // Combined market cap of all coins

    // Bond rating configuration
    pub bond_rating_ordinals: [u8; 10],  // AAA=1, AA=2, etc.
    
    // Global parameters for reserve calculations
    pub min_fiat_reserve_percentage: u8,  // Base 20% from formula in doc
    pub bond_reserve_multiplier: u8,      // 30/9 from formula in doc
    
    // Yield distribution parameters
    pub yield_share_protocol: u8,        // Percentage of yield for protocol
    pub yield_share_issuer: u8,          // Percentage for coin issuers
    pub yield_share_holders: u8,         // Percentage for coin holders (stakers)
    
    // Protocol fees
    pub mint_fee_bps: u16,              // Fee in basis points for minting, if any
    pub burn_fee_bps: u16,              // Fee in basis points for burning, if any

    // Bond mapping
    pub bond_mappings_count: u8,
    pub bond_mappings: [BondCurrencyMapping; MAX_BOND_MAPPINGS],
}
