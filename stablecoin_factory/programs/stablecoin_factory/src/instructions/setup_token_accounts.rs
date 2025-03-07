use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct SetupTokenAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"sovereign_coin", authority.key().as_ref(), sovereign_coin.symbol.as_ref()],
        bump = sovereign_coin.bump,
        constraint = sovereign_coin.authority == authority.key()
    )]
    pub sovereign_coin: Box<Account<'info, SovereignCoin>>,
    
    // SPL Token accounts
    #[account(
        init,
        payer = payer,
        token::mint = fiat_token_mint,
        token::authority = authority,
    )]
    pub fiat_reserve: Box<InterfaceAccount<'info, TokenAccount>>,
    
    #[account(
        init,
        payer = payer,
        token::mint = bond_token_mint,
        token::authority = authority,
    )]
    pub bond_holding: Box<InterfaceAccount<'info, TokenAccount>>,
    
    // External token mints
    pub fiat_token_mint: Box<InterfaceAccount<'info, Mint>>,
    pub bond_token_mint: Box<InterfaceAccount<'info, Mint>>,
    
    // System programs
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

impl SetupTokenAccounts<'_> {
    pub fn handler(ctx: Context<Self>) -> Result<()> {
        // Set token accounts
        let sovereign_coin = &mut ctx.accounts.sovereign_coin;
        sovereign_coin.fiat_reserve = ctx.accounts.fiat_reserve.key();
        sovereign_coin.bond_holding = ctx.accounts.bond_holding.key();

        // Emit event
        let clock = Clock::get()?;
        emit_cpi!(SovereignCoinTokenAccountsEvent {
            fiat_reserve: sovereign_coin.fiat_reserve,
            bond_holding: sovereign_coin.bond_holding,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}
