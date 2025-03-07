import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinFactory } from "../target/types/stablecoin_factory";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("stablecoin_factory", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StablecoinFactory as Program<StablecoinFactory>;
  const authority = provider.wallet.publicKey;

  // Find the factory PDA
  const [factoryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    program.programId
  );

  it("Can initialize factory with valid parameters", async () => {
    // Test parameters that should pass validation
    const minFiatReserve = 20; // This is the 20% minimum reserve percentage mentioned in the formula "Fiat Reserve = 20 + (Ordinal - 1) × 30/9".
    const bondReserveMultiplier = 30; // This is the multiplier (30) from the same formula that adjusts reserve requirements based on bond rating.
    const yieldShareProtocol = 5; // 5% for the protocol/Etherfuse
    const yieldShareIssuer = 15; // 15% for the sovereign coin issuers
    const yieldShareHolders = 80; // 80% for the coin holders/stakers
    // Total of yield shares is 100%

    // Execute the transaction
    const tx = await program.methods
      .initializeFactory(
        minFiatReserve,
        bondReserveMultiplier,
        yieldShareProtocol,
        yieldShareIssuer,
        yieldShareHolders
      )
      .accounts({
        authority: authority,
        factory: factoryPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize Factory Transaction:", tx);

    // Fetch the factory account to verify state
    const factoryAccount = await program.account.factory.fetch(factoryPDA);

    // Verify all state variables were set correctly
    expect(factoryAccount.authority.toString()).to.equal(authority.toString());
    expect(factoryAccount.treasury.toString()).to.equal(authority.toString());
    expect(factoryAccount.totalSovereignCoins.toNumber()).to.equal(0);
    expect(factoryAccount.totalSupplyAllCoins.toNumber()).to.equal(0);
    expect(factoryAccount.minFiatReservePercentage).to.equal(minFiatReserve);
    expect(factoryAccount.bondReserveMultiplier).to.equal(bondReserveMultiplier);
    expect(factoryAccount.yieldShareProtocol).to.equal(yieldShareProtocol);
    expect(factoryAccount.yieldShareIssuer).to.equal(yieldShareIssuer);
    expect(factoryAccount.yieldShareHolders).to.equal(yieldShareHolders);
    expect(factoryAccount.mintFeeBps).to.equal(0);
    expect(factoryAccount.burnFeeBps).to.equal(0);

    // Verify bond rating ordinals
    expect(factoryAccount.bondRatingOrdinals).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
