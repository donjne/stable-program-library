pub fn calculate_required_reserve(base: u8, ordinal: u8, multiplier: u8) -> u8 {
    // Formula: base + (ordinal - 1) * (multiplier / 9)
    base.saturating_add(
        ((ordinal.saturating_sub(1)) as u16 * multiplier as u16 * 10 / 9) as u8
    )
}