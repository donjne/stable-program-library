use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
    Metadata,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Burn, Mint, MintTo, TokenInterface, TokenAccount, Transfer},
};
use stablebond_sdk::find_bond_pda;

pub mod error;
pub mod instructions;
pub mod state;
pub mod helpers;
pub mod events;
pub mod constants;

pub use error::StablecoinError;
pub use instructions::*;
pub use state::*;
pub use helpers::*;
pub use events::*;
pub use constants::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "stablecoin_factory",
    project_url: "https://stable.fun",
    contacts: "email:hello@stable.fun",
    policy: "Build quality.",
    source_code: "https://github.com/donjne/stable-program-library",
    source_release: "v0.1.0",
    auditors: "None for now",
    acknowledgements: "
    The following hackers could've stolen all our money but didn't:
    - Neodyme
    "
}

declare_id!("HEpq3mrVzjWcBksSSVHWwQPWGDhhWJCbiA6AXMKCUBiN");

#[program]
pub mod stablecoin_factory {
    use super::*;

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        min_fiat_reserve: u8,
        bond_reserve_multiplier: u8,
        yield_share_protocol: u8,
        yield_share_issuer: u8,
        yield_share_holders: u8,
    ) -> Result<()> {
        let bump = ctx.bumps.factory;
        
        InitializeFactory::handler(
            ctx,
            bump,
            min_fiat_reserve,
            bond_reserve_multiplier,
            yield_share_protocol,
            yield_share_issuer,
            yield_share_holders,
        )
    }

    pub fn register_bond_maps(
        ctx: Context<RegisterBondMapping>, 
        fiat_currency: String, 
        bond_mint: Pubkey, 
        bond_rating: u8, 
    ) -> Result<()> {
        RegisterBondMapping::handler(ctx, fiat_currency, bond_mint, bond_rating)
    }

    /// Initialize the sovereign coin account
    #[access_control(InitSovereignCoin::validate(&ctx.accounts, &args))]
    pub fn init_sovereign_coin(ctx: Context<InitSovereignCoin>, args: SovereignCoinArgs) -> Result<()> {
        InitSovereignCoin::handler(ctx, args)
    }

    /// Configure tokens, metadata, and finalize
    pub fn setup_mint(ctx: Context<SetupMint>) -> Result<()> {
        SetupMint::handler(ctx)
    }

    pub fn setup_token_accounts(ctx: Context<SetupTokenAccounts>) -> Result<()> {
        SetupTokenAccounts::handler(ctx)
    }

    pub fn finalize_setup(ctx: Context<FinalizeSetup>) -> Result<()> {
        FinalizeSetup::handler(ctx)
    }
}
