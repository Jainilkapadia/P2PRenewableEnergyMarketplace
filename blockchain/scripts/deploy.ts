import { ethers, network } from "hardhat";

async function main() {
  console.log("=================================================");
  console.log("Deploying EnergyDealRegistry Smart Contract...");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();

  console.log(`Network Name : ${network.name}`);
  console.log(`Chain ID     : ${networkInfo.chainId.toString()}`);
  console.log(`Deployer     : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance      : ${ethers.formatEther(balance)} ETH`);

  // Deploy contract
  const EnergyDealRegistryFactory = await ethers.getContractFactory("EnergyDealRegistry");
  const registry = await EnergyDealRegistryFactory.deploy();

  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();

  console.log("-------------------------------------------------");
  console.log(`EnergyDealRegistry deployed to: ${contractAddress}`);
  console.log("-------------------------------------------------");
  console.log("Deployment verified successfully.");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
