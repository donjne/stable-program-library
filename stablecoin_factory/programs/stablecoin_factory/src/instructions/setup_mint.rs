use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct SetupMint<'info> {
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
    
    // Initialize just the mint
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = authority,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    // System programs needed for this specific operation
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

impl SetupMint<'_> {
    pub fn handler(ctx: Context<Self>) -> Result<()> {
        // Set mint account
        let sovereign_coin = &mut ctx.accounts.sovereign_coin;
        sovereign_coin.mint = ctx.accounts.mint.key();

        // Emit event
        let clock = Clock::get()?;
        emit_cpi!(SovereignCoinSetupMintEvent {
            mint: sovereign_coin.mint,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}
