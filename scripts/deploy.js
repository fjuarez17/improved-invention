const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ALLOCATIONS, tgeAmount } = require("./tokenomics");

// Wallets per category. Defaults to the deployer so the MVP can be deployed with one key.
function wallets(deployer) {
  return {
    owner: process.env.OWNER_ADDRESS || deployer,
    oracle: process.env.ORACLE_ADDRESS || deployer,
    treasury: process.env.TREASURY_ADDRESS || deployer,
    team: process.env.TEAM_ADDRESS || deployer,
    investors: process.env.INVESTORS_ADDRESS || deployer,
    airdrop: process.env.AIRDROP_ADDRESS || deployer,
  };
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const w = wallets(deployer);

  console.log(`Network: ${network.name} | Deployer: ${deployer}`);

  const token = await ethers.deployContract("CognitionToken", [deployer, deployer]);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`CognitionToken: ${tokenAddress}`);

  const vesting = await ethers.deployContract("CognitionVesting", [tokenAddress, deployer]);
  await vesting.waitForDeployment();
  const vestingAddress = await vesting.getAddress();
  console.log(`CognitionVesting: ${vestingAddress}`);

  await (await token.setOracleAddress(w.oracle)).wait();
  console.log(`Oracle set to: ${w.oracle}`);

  // Airdrop is 100% liquid at TGE, so it goes straight to its distributor wallet.
  await (await token.transfer(w.airdrop, ALLOCATIONS.airdrop.amount)).wait();

  const locked = ["treasury", "team", "investors"];
  const lockedTotal = locked.reduce((acc, key) => acc + ALLOCATIONS[key].amount, 0n);
  await (await token.transfer(vestingAddress, lockedTotal)).wait();

  const start = (await ethers.provider.getBlock("latest")).timestamp;
  for (const key of locked) {
    const a = ALLOCATIONS[key];
    await (
      await vesting.createSchedule(w[key], a.label, a.amount, tgeAmount(a), start, a.cliff, a.duration)
    ).wait();
    console.log(`Schedule ${a.label}: ${w[key]} | cliff ${a.cliff / 86400}d | vesting ${a.duration / 86400}d`);
  }

  if (w.owner.toLowerCase() !== deployer.toLowerCase()) {
    await (await token.transferOwnership(w.owner)).wait();
    await (await vesting.transferOwnership(w.owner)).wait();
    console.log(`Ownership transfer initiated to ${w.owner} (must accept via acceptOwnership)`);
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    token: tokenAddress,
    vesting: vestingAddress,
    oracle: w.oracle,
    wallets: w,
    tgeTimestamp: start,
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Saved deployments/${network.name}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
