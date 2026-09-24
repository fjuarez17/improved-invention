// Hands the token and vesting contracts over to the operational owner (wallet or multisig).
// Ownable2Step: the new owner must call acceptOwnership() on both contracts.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const newOwner = process.env.NEW_OWNER;
  if (!ethers.isAddress(newOwner || "")) throw new Error("Set NEW_OWNER to a valid address");

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));

  const token = await ethers.getContractAt("CognitionToken", deployment.token);
  const vesting = await ethers.getContractAt("CognitionVesting", deployment.vesting);

  await (await token.transferOwnership(newOwner)).wait();
  await (await vesting.transferOwnership(newOwner)).wait();

  deployment.pendingOwner = newOwner;
  fs.writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(`Token pending owner:   ${await token.pendingOwner()}`);
  console.log(`Vesting pending owner: ${await vesting.pendingOwner()}`);
  console.log(`${newOwner} must now call acceptOwnership() on both contracts.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
