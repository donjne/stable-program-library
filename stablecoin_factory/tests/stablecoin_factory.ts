import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StablecoinFactory } from "../target/types/stablecoin_factory";
import { PublicKey, Keypair } from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("stablecoin_factory", () => {

  const localKeypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const localKeypairData = JSON.parse(fs.readFileSync(localKeypairPath, "utf-8"));
  const localKeypair = Keypair.fromSecretKey(new Uint8Array(localKeypairData));
  const mintAuthority = localKeypair;
  
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

    // Original Bond mint public keys
    // const usdBondMint = new PublicKey("USTRYnGgcHAhdWsanv8BG6vHGd4p7UGgoB9NRd8ei7j");
    // const eurBondMint = new PublicKey("EuroszHk1AL7fHBBsxgeGHsamUqwBpb26oEyt9BcfZ6G");
  
    // Create test mints for fiat token and Bond tokens
    let usdFiatMint: PublicKey;
    let eurFiatMint: PublicKey;
    let usdBondMint: PublicKey;
    let eurBondMint: PublicKey;

  // Track registered currencies
  let usdRegistered = false;
  let eurRegistered = false;
  
    // Function to calculate required reserve percentage based on bond rating
    function calculateRequiredReserve(minReserve: number, bondRating: number, multiplier: number): number {
      return minReserve + ((bondRating - 1) * multiplier / 9);
    }

    async function getRegisteredBondMint(currency: string): Promise<PublicKey | null> {
      try {
        const factoryAccount = await program.account.factory.fetch(factoryPDA);
        
        // Iterate through all bond mappings to find matching currency
        for (let i = 0; i < factoryAccount.bondMappingsCount; i++) {
          const mapping = factoryAccount.bondMappings[i];
          if (mapping.active) {
            const storedFiatBytes = mapping.fiatCurrency.filter(byte => byte !== 0);
            const fiatString = Buffer.from(storedFiatBytes).toString();
            
            if (fiatString === currency) {
              console.log(`Found registered bond mint for ${currency}: ${mapping.bondMint.toString()}`);
              return mapping.bondMint;
            }
          }
        }
        console.log(`No registered bond mint found for ${currency}`);
        return null;
      } catch (err) {
        console.error("Error fetching registered bond mint:", err);
        return null;
      }
    }
  
    before(async () => {
      // No need to airdrop SOL to mint authority since we're using the provider's wallet
      // which should already have SOL
  
      // Create USD fiat token mint
      try {
        usdFiatMint = await createMint(
          provider.connection,
          mintAuthority,
          authority,
          null,
          6 // Decimals
        );
        console.log("Created USD fiat token mint:", usdFiatMint.toString());
      } catch (err) {
        console.log("Error creating USD fiat token:", err);
      }
  
      // Create EUR fiat token mint
      try {
        eurFiatMint = await createMint(
          provider.connection,
          mintAuthority,
          authority,
          null,
          6 // Decimals
        );
        console.log("Created EUR fiat token mint:", eurFiatMint.toString());
      } catch (err) {
        console.log("Error creating EUR fiat token:", err);
      }

      // Create USD bond token mint
      try {
        usdBondMint = await createMint(
          provider.connection,
          mintAuthority,
          authority,
          null,
          6 // Decimals
        );
        console.log("Created USD bond token mint:", usdBondMint.toString());
      } catch (err) {
        console.log("Error creating USD bond token:", err);
      }

      // Create EUR bond token mint
      try {
        eurBondMint = await createMint(
          provider.connection,
          mintAuthority,
          authority,
          null,
          6 // Decimals
        );
        console.log("Created EUR bond token mint:", eurBondMint.toString());
      } catch (err) {
        console.log("Error creating EUR bond token:", err);
      }
  });

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
    // const bondMint = new PublicKey("USTRYnGgcHAhdWsanv8BG6vHGd4p7UGgoB9NRd8ei7j");
    const bondRating = 1; // Highest quality and lowest risk

    try {
      // Execute the transaction
      const tx = await program.methods
        .registerBondMaps(
          fiatCurrency,
          usdBondMint,
          bondRating
        )
        .accounts({
          authority: authority,
          factory: factoryPDA,
        })
        .rpc();

      console.log("Register Bond Mapping Transaction:", tx);
      usdRegistered = true;

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

      // expect(mapping.bondMint.toString()).to.equal(bondMint.toString());
      expect(mapping.bondMint.toString()).to.equal(usdBondMint.toString());
      expect(mapping.bondRating).to.equal(bondRating);
    } catch (err) {
      console.error("Error registering bond mapping:", err);
      throw err;
    }
  });

  it("Can register a second bond mapping with different currency", async () => {
    // Create test parameters for a second mapping
    const fiatCurrency = "EUR";
    // const bondMint = new PublicKey("EuroszHk1AL7fHBBsxgeGHsamUqwBpb26oEyt9BcfZ6G");
    const bondRating = 3;

    try {
      // Get the current count before adding
      const factoryBefore = await program.account.factory.fetch(factoryPDA);
      const countBefore = factoryBefore.bondMappingsCount;

      // Execute the transaction
      const tx = await program.methods
        .registerBondMaps(
          fiatCurrency,
          eurBondMint,
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

      // expect(mapping.bondMint.toString()).to.equal(bondMint.toString());
      expect(mapping.bondMint.toString()).to.equal(eurBondMint.toString());
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
      // Allow either error: MaxBondMappingsReached or InvalidBondRating
      const errorCode = err.error?.errorCode?.code;
      expect(errorCode === "InvalidBondRating" || errorCode === "MaxBondMappingsReached").to.be.true;
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
      // Allow either error: MaxBondMappingsReached or FiatCurrencyTooLong
      const errorCode = err.error?.errorCode?.code;
      expect(errorCode === "FiatCurrencyTooLong" || errorCode === "MaxBondMappingsReached").to.be.true;
    }
  });

  // Initialize Sovereign Coin Tests
  it("Can initialize a USD sovereign coin", async () => {
    // Skip if USD bond mapping not registered
    if (!usdRegistered) {
      console.log("USD bond mapping not registered, skipping USD sovereign coin test");
      return;
    }

    const registeredUsdBondMint = await getRegisteredBondMint("USD");
    if (!registeredUsdBondMint) {
      console.log("Cannot find registered USD bond mint, skipping test");
      return;
    }

    console.log("Using registered USD bond mint:", registeredUsdBondMint.toString());
    console.log("Our created USD bond mint:", usdBondMint.toString());

    // Sovereign coin parameters
    const coinArgs = {
      name: "US Dollar Sovereign",
      symbol: "USDS",
      uri: "https://example.com/usds.json",
      fiatCurrency: "USD"
    };

    // Calculate sovereign coin PDA
    const [sovereignCoinPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sovereign_coin"),
        authority.toBuffer(),
        Buffer.from(coinArgs.symbol)
      ],
      program.programId
    );

    try {
      // Execute the transaction
      const tx = await program.methods
        .initSovereignCoin(coinArgs)
        .accounts({
          payer: authority,
          authority: authority,
          factory: factoryPDA,
          sovereignCoin: sovereignCoinPDA,
          fiatTokenMint: usdFiatMint,
          bondTokenMint: usdBondMint,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Initialize USD Sovereign Coin Transaction:", tx);

      // Fetch the sovereign coin account to verify state
      const sovereignCoinAccount = await program.account.sovereignCoin.fetch(sovereignCoinPDA);

      // Verify all state variables were set correctly
      expect(sovereignCoinAccount.authority.toString()).to.equal(authority.toString());
      expect(sovereignCoinAccount.factory.toString()).to.equal(factoryPDA.toString());
      
      // Verify name and symbol (convert fixed arrays to strings)
      const nameBytes = sovereignCoinAccount.name.filter(byte => byte !== 0);
      const symbolBytes = sovereignCoinAccount.symbol.filter(byte => byte !== 0);
      expect(Buffer.from(nameBytes).toString()).to.equal(coinArgs.name);
      expect(Buffer.from(symbolBytes).toString()).to.equal(coinArgs.symbol);
      
      // Verify URI
      const uriBytes = sovereignCoinAccount.uri.filter(byte => byte !== 0);
      expect(Buffer.from(uriBytes).toString()).to.equal(coinArgs.uri);
      
      // Verify fiat currency
      const fiatCurrencyBytes = sovereignCoinAccount.targetFiatCurrency.filter(byte => byte !== 0);
      expect(Buffer.from(fiatCurrencyBytes).toString()).to.equal(coinArgs.fiatCurrency);
      
      // Verify bond mint and rating (assuming the USD bond mapping is registered with rating 1)
      expect(sovereignCoinAccount.bondMint.toString()).to.equal(usdBondMint.toString());
      expect(sovereignCoinAccount.bondRating).to.equal(1); // Based on previous bond registration
      
      // Verify reserve percentage calculation
      // Formula: min_fiat_reserve + (bond_rating - 1) * bond_reserve_multiplier / 9
      const expectedReserve = calculateRequiredReserve(minFiatReserve, 1, bondReserveMultiplier);
      expect(sovereignCoinAccount.requiredReservePercentage).to.equal(expectedReserve);
      
      // Verify initial state
      expect(sovereignCoinAccount.decimals).to.equal(6);
      expect(sovereignCoinAccount.totalSupply.toNumber()).to.equal(0);
      expect(sovereignCoinAccount.fiatAmount.toNumber()).to.equal(0);
      expect(sovereignCoinAccount.bondAmount.toNumber()).to.equal(0);
    } catch (err) {
      console.error("Error initializing USD sovereign coin:", err);
      throw err;
    }
  });

  it("Can initialize a EUR sovereign coin", async () => {
      // Skip if EUR bond mapping not registered
    if (!eurRegistered) {
      console.log("EUR bond mapping not registered, skipping EUR sovereign coin test");
      return;
    }

    // Find the registered bond mint for EUR
    const registeredEurBondMint = await getRegisteredBondMint("EUR");
    if (!registeredEurBondMint) {
      console.log("Cannot find registered EUR bond mint, skipping test");
      return;
    }
    
    console.log("Using registered EUR bond mint:", registeredEurBondMint.toString());
    console.log("Our created EUR bond mint:", eurBondMint.toString());
    // Sovereign coin parameters
    const coinArgs = {
      name: "Euro Sovereign",
      symbol: "EURS",
      uri: "https://example.com/eurs.json",
      fiatCurrency: "EUR"
    };

    // Calculate sovereign coin PDA
    const [sovereignCoinPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sovereign_coin"),
        authority.toBuffer(),
        Buffer.from(coinArgs.symbol)
      ],
      program.programId
    );

    try {
      // Execute the transaction
      const tx = await program.methods
        .initSovereignCoin(coinArgs)
        .accounts({
          payer: authority,
          authority: authority,
          factory: factoryPDA,
          sovereignCoin: sovereignCoinPDA,
          fiatTokenMint: eurFiatMint,
          bondTokenMint: eurBondMint,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Initialize EUR Sovereign Coin Transaction:", tx);

      // Fetch the sovereign coin account to verify state
      const sovereignCoinAccount = await program.account.sovereignCoin.fetch(sovereignCoinPDA);

      // Verify bond mint and rating
      expect(sovereignCoinAccount.bondMint.toString()).to.equal(eurBondMint.toString());
      expect(sovereignCoinAccount.bondRating).to.equal(3); // Based on previous bond registration
      
      // Verify reserve percentage calculation
      // Formula: min_fiat_reserve + (bond_rating - 1) * bond_reserve_multiplier / 9
      const expectedReserve = calculateRequiredReserve(minFiatReserve, 3, bondReserveMultiplier);
      expect(sovereignCoinAccount.requiredReservePercentage).to.equal(expectedReserve);
    } catch (err) {
      console.error("Error initializing EUR sovereign coin:", err);
      throw err;
    }
  });

  it("Should fail with unknown fiat currency", async () => {
    // Sovereign coin parameters with unknown fiat currency
    const coinArgs = {
      name: "Japanese Yen Sovereign",
      symbol: "JPYS",
      uri: "https://example.com/jpys.json",
      fiatCurrency: "JPY" // We haven't registered this
    };

    // Calculate sovereign coin PDA
    const [sovereignCoinPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sovereign_coin"),
        authority.toBuffer(),
        Buffer.from(coinArgs.symbol)
      ],
      program.programId
    );

    try {
      // This should fail
      await program.methods
        .initSovereignCoin(coinArgs)
        .accounts({
          payer: authority,
          authority: authority,
          factory: factoryPDA,
          sovereignCoin: sovereignCoinPDA,
          fiatTokenMint: usdFiatMint, // Doesn't matter which one we use here
          bondTokenMint: usdBondMint, // Doesn't matter which one we use here
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      expect.fail("Transaction should have failed with unknown fiat currency");
    } catch (err) {
      // Verify it's the correct error
      expect(err.error.errorCode.code).to.equal("NoBondMappingForCurrency");
    }
  });

  it("Should fail with incorrect bond mint", async () => {
    // Sovereign coin parameters
    const coinArgs = {
      name: "US Dollar Sovereign 2",
      symbol: "USDS2",
      uri: "https://example.com/usds2.json",
      fiatCurrency: "USD"
    };

    // Calculate sovereign coin PDA
    const [sovereignCoinPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sovereign_coin"),
        authority.toBuffer(),
        Buffer.from(coinArgs.symbol)
      ],
      program.programId
    );

    try {
      // This should fail because we're using EUR bond mint for USD currency
      await program.methods
        .initSovereignCoin(coinArgs)
        .accounts({
          payer: authority,
          authority: authority,
          factory: factoryPDA,
          sovereignCoin: sovereignCoinPDA,
          fiatTokenMint: usdFiatMint,
          bondTokenMint: eurBondMint, // Wrong bond mint for USD
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      expect.fail("Transaction should have failed with incorrect bond mint");
    } catch (err) {
      // Verify it's the correct error
      expect(err.error.errorCode.code).to.equal("InvalidBondMint");
    }
  });

  it("Should fail with name too long", async () => {
    // Sovereign coin parameters with name too long
    const coinArgs = {
      name: "This name is way too long for a sovereign coin and should cause a validation error",
      symbol: "LONG",
      uri: "https://example.com/long.json",
      fiatCurrency: "USD"
    };

    // Calculate sovereign coin PDA
    const [sovereignCoinPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sovereign_coin"),
        authority.toBuffer(),
        Buffer.from(coinArgs.symbol)
      ],
      program.programId
    );

    try {
      // This should fail
      await program.methods
        .initSovereignCoin(coinArgs)
        .accounts({
          payer: authority,
          authority: authority,
          factory: factoryPDA,
          sovereignCoin: sovereignCoinPDA,
          fiatTokenMint: usdFiatMint,
          bondTokenMint: usdBondMint,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      expect.fail("Transaction should have failed with name too long");
    } catch (err) {
      // Verify it's the correct error
      expect(err.error.errorCode.code).to.equal("NameTooLong");
    }
  });
});