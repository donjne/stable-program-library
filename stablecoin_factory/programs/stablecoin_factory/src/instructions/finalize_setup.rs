use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct FinalizeSetup<'info> {
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
    
    #[account(
        mut, 
        seeds = [b"factory"],
        bump = factory.bump,
    )]
    pub factory: Box<Account<'info, Factory>>,
    
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    
    // Metadata-related accounts
    /// CHECK: Will be created via CPI to token metadata program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    pub token_metadata_program: Program<'info, Metadata>,
    
    // System programs
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl FinalizeSetup<'_> {
    pub fn handler(ctx: Context<Self>) -> Result<()> {
        let sovereign_coin = &ctx.accounts.sovereign_coin;
        
        // Extract data from sovereign_coin for metadata
        let name = std::str::from_utf8(
            &sovereign_coin.name
                .iter()
                .take_while(|&&b| b != 0)
                .cloned()
                .collect::<Vec<u8>>()
        ).unwrap_or("").to_string();
        
        let symbol = std::str::from_utf8(
            &sovereign_coin.symbol
                .iter()
                .take_while(|&&b| b != 0)
                .cloned()
                .collect::<Vec<u8>>()
        ).unwrap_or("").to_string();
        
        let uri = std::str::from_utf8(
            &sovereign_coin.uri
                .iter()
                .take_while(|&&b| b != 0)
                .cloned()
                .collect::<Vec<u8>>()
        ).unwrap_or("").to_string();
        
        // Create metadata
        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        
        create_metadata_accounts_v3(
            CpiContext::new(cpi_program, cpi_accounts),
            DataV2 {
                name: name.clone(),
                symbol: symbol.clone(),
                uri: uri.clone(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            false,
            true,
            None,
        )?;
        
        // Update factory stats
        let factory = &mut ctx.accounts.factory;
        factory.total_sovereign_coins = factory.total_sovereign_coins.checked_add(1)
            .ok_or(StablecoinError::ArithmeticOverflow)?;
        
        // Get fiat currency string from sovereign_coin
        let fiat_currency = std::str::from_utf8(
            &sovereign_coin.target_fiat_currency
                .iter()
                .take_while(|&&b| b != 0)
                .cloned()
                .collect::<Vec<u8>>()
        ).unwrap_or("").to_string();
        
        // Emit event
        let clock = Clock::get()?;
        emit_cpi!(SovereignCoinCreatedEvent {
            authority: ctx.accounts.authority.key(),
            sovereign_coin: sovereign_coin.key(),
            mint: ctx.accounts.mint.key(),
            name,
            symbol,
            fiat_currency,
            bond_mint: sovereign_coin.bond_mint,
            bond_account: sovereign_coin.bond_account,
            bond_rating: sovereign_coin.bond_rating,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}
