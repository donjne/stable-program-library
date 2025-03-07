use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct RegisterBondMapping<'info> {
    #[account(
        constraint = authority.key() == factory.authority @ StablecoinError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub factory: Box<Account<'info, Factory>>,
}

impl RegisterBondMapping<'_> {
    pub fn handler(
        ctx: Context<RegisterBondMapping>,
        fiat_currency: String,
        bond_mint: Pubkey,
        bond_rating: u8,  // Add bond rating parameter
    ) -> Result<()> {
        // Validate bond rating
        require!(
            bond_rating >= 1 && bond_rating <= 10, 
            StablecoinError::InvalidBondRating
        );
        
        let factory = &mut ctx.accounts.factory;
        
        // Ensure we're not exceeding max mappings
        require!(
            factory.bond_mappings_count < MAX_BOND_MAPPINGS as u8,
            StablecoinError::MaxBondMappingsReached
        );
        
        // Check if this currency is already mapped
        let fiat_bytes = fiat_currency.as_bytes();
        require!(fiat_bytes.len() <= 8, StablecoinError::FiatCurrencyTooLong);
        
        // Add the new mapping
        let index = factory.bond_mappings_count as usize;
        let mapping = &mut factory.bond_mappings[index];
        mapping.active = true;
        
        mapping.fiat_currency = [0u8; 8];
        mapping.fiat_currency[..fiat_bytes.len()].copy_from_slice(fiat_bytes);
        
        mapping.bond_mint = bond_mint;
        mapping.bond_rating = bond_rating;  // Store the bond rating
        
        // Increment counter
        factory.bond_mappings_count += 1;
        
        // Emit the registration event
        let clock = Clock::get()?;
        emit_cpi!(BondMappingRegisteredEvent {
            authority: ctx.accounts.authority.key(),
            factory: ctx.accounts.factory.key(),
            fiat_currency,
            bond_mint,
            bond_rating,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}
