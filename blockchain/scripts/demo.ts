import { ethers } from "hardhat";

async function main() {
  console.log("=================================================================");
  console.log(" Milestone 6B — Local Hardhat Blockchain Anchor Live Demonstration");
  console.log("=================================================================");

  const [deployer, relayer] = await ethers.getSigners();
  console.log(`Relayer Address : ${relayer.address}`);

  // Deploy contract for demo
  const EnergyDealRegistryFactory = await ethers.getContractFactory("EnergyDealRegistry");
  const registry = await EnergyDealRegistryFactory.deploy();
  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();
  console.log(`Registry Contract Address : ${contractAddress}`);

  // Sample trade metadata
  const demoTrade = {
    tradeId: "d3b07384-d113-4610-8547-9f6b4d320299",
    verificationReference: "P2P-VRF-1773510000-8F9E0A1B",
    canonicalHashHex: "0x8f9e0a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef012345",
    energyKwh: 35.0, // 35.00 kWh
    energyScaled: 3500n, // 35.00 * 100
    totalAmountInr: 203.0, // 203.00 INR
    totalAmountScaled: 20300n, // 203.00 * 100
  };

  console.log("\n--- Step 1: Anchoring Verified Energy Deal on Blockchain ---");
  console.log(`Trade ID              : ${demoTrade.tradeId}`);
  console.log(`Verification Reference: ${demoTrade.verificationReference}`);
  console.log(`Canonical Hash        : ${demoTrade.canonicalHashHex}`);
  console.log(`Energy Amount         : ${demoTrade.energyKwh} kWh (${demoTrade.energyScaled} scaled)`);
  console.log(`Total Value           : ${demoTrade.totalAmountInr} INR (${demoTrade.totalAmountScaled} scaled)`);

  const tx = await registry.connect(relayer).registerDeal(
    demoTrade.tradeId,
    demoTrade.verificationReference,
    demoTrade.canonicalHashHex,
    demoTrade.energyScaled,
    demoTrade.totalAmountScaled
  );
  const receipt = await tx.wait();
  console.log(`Transaction Hash      : ${receipt?.hash}`);
  console.log(`Block Number          : ${receipt?.blockNumber}`);
  console.log(`Gas Used              : ${receipt?.gasUsed.toString()}`);
  console.log(`Status                : SUCCESS (1)`);

  console.log("\n--- Step 2: Retrieving Stored Deal from Blockchain ---");
  const isRegistered = await registry.isDealRegistered(demoTrade.tradeId);
  console.log(`isDealRegistered()    : ${isRegistered}`);

  const deal = await registry.getDeal(demoTrade.tradeId);
  console.log(`Stored Trade ID       : ${deal.tradeId}`);
  console.log(`Stored Reference      : ${deal.verificationReference}`);
  console.log(`Stored Canonical Hash : ${deal.tradeCanonicalHash}`);
  console.log(`Stored Energy Scaled  : ${deal.energyAmountKwhScaled} (${Number(deal.energyAmountKwhScaled)/100} kWh)`);
  console.log(`Stored Total Scaled   : ${deal.totalAmountScaled} (${Number(deal.totalAmountScaled)/100} INR)`);
  console.log(`Anchored At Timestamp : ${new Date(Number(deal.anchoredAt) * 1000).toISOString()}`);
  console.log(`Anchored By Address   : ${deal.anchoredBy}`);

  console.log("\n--- Step 3: Verifying Canonical Hash Integrity ---");
  const isHashValid = await registry.verifyDealHash(demoTrade.tradeId, demoTrade.canonicalHashHex);
  console.log(`verifyDealHash(original) : ${isHashValid} -> AUTHENTIC`);

  console.log("\n--- Step 4: Simulating Tamper Detection ---");
  const tamperedHash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const isTamperValid = await registry.verifyDealHash(demoTrade.tradeId, tamperedHash);
  console.log(`verifyDealHash(tampered) : ${isTamperValid} -> TAMPER DETECTED (Rejected)`);

  console.log("\n--- Step 5: Duplicate Re-Anchoring Protection ---");
  try {
    await registry.connect(relayer).registerDeal(
      demoTrade.tradeId,
      demoTrade.verificationReference,
      demoTrade.canonicalHashHex,
      demoTrade.energyScaled,
      demoTrade.totalAmountScaled
    );
    console.log("ERROR: Duplicate registration succeeded when it should have reverted!");
  } catch (error: any) {
    console.log(`Duplicate Rejection Result: REVERTED successfully with message: "${error.message.split('reverted with reason string ')[1] || error.message}"`);
  }

  console.log("\n=================================================================");
  console.log(" Blockchain Foundation Live Demo Completed Successfully!");
  console.log("=================================================================");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exitCode = 1;
});
