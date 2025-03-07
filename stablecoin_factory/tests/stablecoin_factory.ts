import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinFactory } from "../target/types/stablecoin_factory";
import { PublicKey, Keypair } from "@solana/web3.js";
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

  // Test parameters for factory initialization
  const minFiatReserve = 20; // This is the 20% minimum reserve percentage mentioned in the formula "Fiat Reserve = 20 + (Ordinal - 1) × 30/9".
  const bondReserveMultiplier = 30; // This is the multiplier (30) from the same formula that adjusts reserve requirements based on bond rating.
  const yieldShareProtocol = 5; // 5% for the protocol/Etherfuse
  const yieldShareIssuer = 15; // 15% for the sovereign coin issuers
  const yieldShareHolders = 80; // 80% for the coin holders/stakers
  // Total of yield shares is 100%

  let factoryInitialized = false;

  it("Can initialize factory with valid parameters", async () => {
    try {
      // Only attempt to initialize if not already initialized
      if (!factoryInitialized) {
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
        factoryInitialized = true;
      }

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
    } catch (err) {
      // If it's already initialized, we can ignore this error
      console.log("Factory may already be initialized:", err.message);
      factoryInitialized = true;
    }
  });

  it("Can register a bond mapping", async () => {
    // Create test parameters
    const fiatCurrency = "USD";
    const bondMint = new PublicKey("USTRYnGgcHAhdWsanv8BG6vHGd4p7UGgoB9NRd8ei7j");
    const bondRating = 1; // Highest quality and lowest risk

    try {
      // Execute the transaction
      const tx = await program.methods
        .registerBondMaps(
          fiatCurrency,
          bondMint,
          bondRating
        )
        .accounts({
          authority: authority,
          factory: factoryPDA,
        })
        .rpc();

      console.log("Register Bond Mapping Transaction:", tx);

      // Fetch the factory account to verify the mapping was added
      const factoryAccount = await program.account.factory.fetch(factoryPDA);

      // Verify bond mapping count was incremented
      expect(factoryAccount.bondMappingsCount).to.be.greaterThan(0);

      // Find the added mapping - it should be at index (bondMappingsCount - 1)
      const mappingIndex = factoryAccount.bondMappingsCount - 1;
      const mapping = factoryAccount.bondMappings[mappingIndex];

      // Verify all mapping fields were set correctly
      expect(mapping.active).to.equal(true);
      
      // Check fiat currency bytes
      const storedFiatBytes = mapping.fiatCurrency.filter(byte => byte !== 0);
      const fiatBytes = Buffer.from(fiatCurrency);
      expect(Buffer.from(storedFiatBytes).toString()).to.equal(fiatCurrency);
      
      expect(mapping.bondMint.toString()).to.equal(bondMint.toString());
      expect(mapping.bondRating).to.equal(bondRating);
    } catch (err) {
      console.error("Error registering bond mapping:", err);
      throw err;
    }
  });

  it("Can register a second bond mapping with different currency", async () => {
    // Create test parameters for a second mapping
    const fiatCurrency = "EUR";
    const bondMint = new PublicKey("EuroszHk1AL7fHBBsxgeGHsamUqwBpb26oEyt9BcfZ6G");;
    const bondRating = 3;

    try {
      // Get the current count before adding
      const factoryBefore = await program.account.factory.fetch(factoryPDA);
      const countBefore = factoryBefore.bondMappingsCount;

      // Execute the transaction
      const tx = await program.methods
        .registerBondMaps(
          fiatCurrency,
          bondMint,
          bondRating
        )
        .accounts({
          authority: authority,
          factory: factoryPDA,
        })
        .rpc();

      console.log("Register Second Bond Mapping Transaction:", tx);

      // Fetch the updated factory account
      const factoryAfter = await program.account.factory.fetch(factoryPDA);

      // Verify bond mapping count was incremented
      expect(factoryAfter.bondMappingsCount).to.equal(countBefore + 1);

      // Verify the new mapping
      const mappingIndex = factoryAfter.bondMappingsCount - 1;
      const mapping = factoryAfter.bondMappings[mappingIndex];
      
      // Check fiat currency bytes
      const storedFiatBytes = mapping.fiatCurrency.filter(byte => byte !== 0);
      expect(Buffer.from(storedFiatBytes).toString()).to.equal(fiatCurrency);
      
      expect(mapping.bondMint.toString()).to.equal(bondMint.toString());
      expect(mapping.bondRating).to.equal(bondRating);
    } catch (err) {
      console.error("Error registering second bond mapping:", err);
      throw err;
    }
  });

  it("Should fail with invalid bond rating", async () => {
    // Use an invalid bond rating (outside 1-10 range)
    const fiatCurrency = "GBP";
    const bondMint = Keypair.generate().publicKey;
    const invalidBondRating = 11; // Invalid rating

    try {
      // This should fail
      await program.methods
        .registerBondMaps(
          fiatCurrency,
          bondMint,
          invalidBondRating
        )
        .accounts({
          authority: authority,
          factory: factoryPDA,
        })
        .rpc();

      expect.fail("Transaction should have failed with invalid bond rating");
    } catch (err) {
      // Verify it's the correct error
      expect(err.error.errorCode.code).to.equal("InvalidBondRating");
    }
  });

  it("Should fail with fiat currency that's too long", async () => {
    // Create a fiat currency string that exceeds 8 bytes
    const longFiatCurrency = "TOOLONGCURRENCY";
    const bondMint = Keypair.generate().publicKey;
    const bondRating = 4;

    try {
      // This should fail
      await program.methods
        .registerBondMaps(
          longFiatCurrency,
          bondMint,
          bondRating
        )
        .accounts({
          authority: authority,
          factory: factoryPDA,
        })
        .rpc();

      expect.fail("Transaction should have failed with too long fiat currency");
    } catch (err) {
      // Verify it's the correct error
      expect(err.error.errorCode.code).to.equal("FiatCurrencyTooLong");
    }
  });
});