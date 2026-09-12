import { expect } from "chai";
import { ethers } from "hardhat";
import { EnergyDealRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EnergyDealRegistry Smart Contract Tests", () => {
  let registry: EnergyDealRegistry;
  let deployer: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let unauthorizedUser: HardhatEthersSigner;

  // Sample valid test fixtures
  const sampleTradeA = {
    tradeId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    verificationReference: "P2P-VRF-1773500000-A1B2C3D4",
    // 64-character SHA-256 hex converted to bytes32:
    canonicalHashHex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    canonicalHashBytes32: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    energyKwh: 25.5, // 25.50 kWh
    energyScaled: 2550n, // 25.50 * 100
    totalAmountInr: 145.0, // 145.00 INR
    totalAmountScaled: 14500n, // 145.00 * 100
  };

  const sampleTradeB = {
    tradeId: "11112222-3333-4444-5555-666677778888",
    verificationReference: "P2P-VRF-1773500001-E5F6G7H8",
    canonicalHashHex: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    canonicalHashBytes32: "0xca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    energyKwh: 50.0, // 50.00 kWh
    energyScaled: 5000n, // 50.00 * 100
    totalAmountInr: 290.0, // 290.00 INR
    totalAmountScaled: 29000n, // 290.00 * 100
  };

  beforeEach(async () => {
    [deployer, relayer, unauthorizedUser] = await ethers.getSigners();
    const EnergyDealRegistryFactory = await ethers.getContractFactory("EnergyDealRegistry");
    registry = await EnergyDealRegistryFactory.deploy();
    await registry.waitForDeployment();
  });

  describe("1. Deployment & Initial State", () => {
    it("should deploy successfully and have zero total deals", async () => {
      expect(await registry.getAddress()).to.properAddress;
      expect(await registry.totalDealsCount()).to.equal(0n);
      expect(await registry.SCALE_FACTOR()).to.equal(100n);
    });

    it("should report unregistered trade as false and revert getDeal", async () => {
      const isRegistered = await registry.isDealRegistered(sampleTradeA.tradeId);
      expect(isRegistered).to.be.false;

      await expect(registry.getDeal(sampleTradeA.tradeId)).to.be.revertedWith(
        "EnergyDealRegistry: Trade not found"
      );
    });
  });

  describe("2. Trade Anchoring (Registration)", () => {
    it("should successfully anchor a valid verified trade and emit DealAnchored event", async () => {
      const tx = await registry.connect(relayer).registerDeal(
        sampleTradeA.tradeId,
        sampleTradeA.verificationReference,
        sampleTradeA.canonicalHashBytes32,
        sampleTradeA.energyScaled,
        sampleTradeA.totalAmountScaled
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);

      // Verify state updates
      expect(await registry.isDealRegistered(sampleTradeA.tradeId)).to.be.true;
      expect(await registry.totalDealsCount()).to.equal(1n);

      // Verify event emission with expected arguments
      await expect(tx)
        .to.emit(registry, "DealAnchored")
        .withArgs(
          sampleTradeA.tradeId,
          sampleTradeA.verificationReference,
          sampleTradeA.canonicalHashBytes32,
          sampleTradeA.energyScaled,
          sampleTradeA.totalAmountScaled,
          (val: any) => val > 0n,
          relayer.address
        );
    });

    it("should accurately retrieve stored deal metadata", async () => {
      await registry.connect(relayer).registerDeal(
        sampleTradeA.tradeId,
        sampleTradeA.verificationReference,
        sampleTradeA.canonicalHashBytes32,
        sampleTradeA.energyScaled,
        sampleTradeA.totalAmountScaled
      );

      const deal = await registry.getDeal(sampleTradeA.tradeId);
      expect(deal.tradeId).to.equal(sampleTradeA.tradeId);
      expect(deal.verificationReference).to.equal(sampleTradeA.verificationReference);
      expect(deal.tradeCanonicalHash).to.equal(sampleTradeA.canonicalHashBytes32);
      expect(deal.energyAmountKwhScaled).to.equal(sampleTradeA.energyScaled);
      expect(deal.totalAmountScaled).to.equal(sampleTradeA.totalAmountScaled);
      expect(deal.anchoredBy).to.equal(relayer.address);
      expect(deal.anchoredAt).to.be.greaterThan(0n);
    });
  });

  describe("3. Duplicate Protection", () => {
    it("should revert if the same tradeId is registered twice", async () => {
      // First registration succeeds
      await registry.connect(relayer).registerDeal(
        sampleTradeA.tradeId,
        sampleTradeA.verificationReference,
        sampleTradeA.canonicalHashBytes32,
        sampleTradeA.energyScaled,
        sampleTradeA.totalAmountScaled
      );

      // Second registration MUST revert
      await expect(
        registry.connect(relayer).registerDeal(
          sampleTradeA.tradeId,
          sampleTradeA.verificationReference,
          sampleTradeA.canonicalHashBytes32,
          sampleTradeA.energyScaled,
          sampleTradeA.totalAmountScaled
        )
      ).to.be.revertedWith("EnergyDealRegistry: Trade already registered");

      // Total count remains 1
      expect(await registry.totalDealsCount()).to.equal(1n);
    });
  });

  describe("4. On-Chain Hash Verification & Tamper Detection", () => {
    beforeEach(async () => {
      await registry.connect(relayer).registerDeal(
        sampleTradeA.tradeId,
        sampleTradeA.verificationReference,
        sampleTradeA.canonicalHashBytes32,
        sampleTradeA.energyScaled,
        sampleTradeA.totalAmountScaled
      );
    });

    it("should return true when verifying matching canonical hash", async () => {
      const isValid = await registry.verifyDealHash(
        sampleTradeA.tradeId,
        sampleTradeA.canonicalHashBytes32
      );
      expect(isValid).to.be.true;
    });

    it("should return false when verifying tampered / mismatched hash", async () => {
      // Different hash representing modified payload
      const tamperedHashBytes32 =
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      const isValid = await registry.verifyDealHash(
        sampleTradeA.tradeId,
        tamperedHashBytes32
      );
      expect(isValid).to.be.false;
    });

    it("should return false when verifying an unanchored tradeId", async () => {
      const isValid = await registry.verifyDealHash(
        "non-existent-trade-id",
        sampleTradeA.canonicalHashBytes32
      );
      expect(isValid).to.be.false;
    });
  });

  describe("5. Critical Cross-Trade State Isolation", () => {
    it("should maintain completely independent state between multiple trades", async () => {
      // Register Trade A
      await registry.connect(relayer).registerDeal(
        sampleTradeA.tradeId,
        sampleTradeA.verificationReference,
        sampleTradeA.canonicalHashBytes32,
        sampleTradeA.energyScaled,
        sampleTradeA.totalAmountScaled
      );

      // Register Trade B
      await registry.connect(deployer).registerDeal(
        sampleTradeB.tradeId,
        sampleTradeB.verificationReference,
        sampleTradeB.canonicalHashBytes32,
        sampleTradeB.energyScaled,
        sampleTradeB.totalAmountScaled
      );

      // Total deals count must be 2
      expect(await registry.totalDealsCount()).to.equal(2n);

      // Verify Trade A state
      const dealA = await registry.getDeal(sampleTradeA.tradeId);
      expect(dealA.tradeCanonicalHash).to.equal(sampleTradeA.canonicalHashBytes32);
      expect(dealA.energyAmountKwhScaled).to.equal(sampleTradeA.energyScaled);
      expect(dealA.anchoredBy).to.equal(relayer.address);

      // Verify Trade B state
      const dealB = await registry.getDeal(sampleTradeB.tradeId);
      expect(dealB.tradeCanonicalHash).to.equal(sampleTradeB.canonicalHashBytes32);
      expect(dealB.energyAmountKwhScaled).to.equal(sampleTradeB.energyScaled);
      expect(dealB.anchoredBy).to.equal(deployer.address);

      // Cross-verification tests (Isolation proof)
      expect(await registry.verifyDealHash(sampleTradeA.tradeId, sampleTradeA.canonicalHashBytes32)).to.be.true;
      expect(await registry.verifyDealHash(sampleTradeA.tradeId, sampleTradeB.canonicalHashBytes32)).to.be.false;

      expect(await registry.verifyDealHash(sampleTradeB.tradeId, sampleTradeB.canonicalHashBytes32)).to.be.true;
      expect(await registry.verifyDealHash(sampleTradeB.tradeId, sampleTradeA.canonicalHashBytes32)).to.be.false;
    });
  });

  describe("6. Input Validation & Edge Cases", () => {
    it("should reject empty tradeId", async () => {
      await expect(
        registry.registerDeal(
          "",
          sampleTradeA.verificationReference,
          sampleTradeA.canonicalHashBytes32,
          sampleTradeA.energyScaled,
          sampleTradeA.totalAmountScaled
        )
      ).to.be.revertedWith("EnergyDealRegistry: Invalid empty tradeId");
    });

    it("should reject empty verificationReference", async () => {
      await expect(
        registry.registerDeal(
          sampleTradeA.tradeId,
          "",
          sampleTradeA.canonicalHashBytes32,
          sampleTradeA.energyScaled,
          sampleTradeA.totalAmountScaled
        )
      ).to.be.revertedWith("EnergyDealRegistry: Invalid empty verificationReference");
    });

    it("should reject zero hash (bytes32(0))", async () => {
      await expect(
        registry.registerDeal(
          sampleTradeA.tradeId,
          sampleTradeA.verificationReference,
          ethers.ZeroHash,
          sampleTradeA.energyScaled,
          sampleTradeA.totalAmountScaled
        )
      ).to.be.revertedWith("EnergyDealRegistry: Invalid zero hash");
    });

    it("should reject zero energy amount", async () => {
      await expect(
        registry.registerDeal(
          sampleTradeA.tradeId,
          sampleTradeA.verificationReference,
          sampleTradeA.canonicalHashBytes32,
          0n,
          sampleTradeA.totalAmountScaled
        )
      ).to.be.revertedWith("EnergyDealRegistry: Energy amount must be greater than zero");
    });
  });
});
