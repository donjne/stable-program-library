use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + Factory::INIT_SPACE,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Box<Account<'info, Factory>>,
    
    pub system_program: Program<'info, System>,
}

impl InitializeFactory<'_> {
    pub fn handler(
        ctx: Context<InitializeFactory>,
        bump: u8,
        min_fiat_reserve: u8,
        bond_reserve_multiplier: u8,
        yield_share_protocol: u8,
        yield_share_issuer: u8,
        yield_share_holders: u8,
    ) -> Result<()> {
        let factory = &mut ctx.accounts.factory;
        
        // Validate parameters
        require!(
            yield_share_protocol + yield_share_issuer + yield_share_holders == 100,
            StablecoinError::InvalidYieldDistribution
        );
        
        // Initialize factory state
        factory.bump = bump;
        factory.authority = ctx.accounts.authority.key();
        factory.treasury = ctx.accounts.authority.key(); // Initially set treasury to authority
        
        factory.total_sovereign_coins = 0;
        factory.total_supply_all_coins = 0;
        
        // Set bond rating ordinals according to whitepaper
        factory.bond_rating_ordinals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        
        // Set reserve parameters
        factory.min_fiat_reserve_percentage = min_fiat_reserve;
        factory.bond_reserve_multiplier = bond_reserve_multiplier;
        
        // Set yield distribution parameters
        factory.yield_share_protocol = yield_share_protocol;
        factory.yield_share_issuer = yield_share_issuer;
        factory.yield_share_holders = yield_share_holders;
        
        // Initialize with zero fees
        factory.mint_fee_bps = 0;
        factory.burn_fee_bps = 0;

        // Emit the initialization event
        let clock = Clock::get()?;
        emit_cpi!(FactoryInitializedEvent {
            authority: ctx.accounts.authority.key(),
            factory: ctx.accounts.factory.key(),
            min_fiat_reserve,
            bond_reserve_multiplier,
            yield_share_protocol,
            yield_share_issuer,
            yield_share_holders,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}
