// Example of what the CalchAI backend (Vertex AI evaluator) does after validating a reasoning trace:
// it pins the chat to IPFS, gets a CID, and settles the reward on Monad.
//
//   USER=0x... AMOUNT=25 CID=bafy... npx hardhat run scripts/mintReward.js --network monadTestnet
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run scripts/deploy.js first.`);
  const { token: tokenAddress } = JSON.parse(fs.readFileSync(file, "utf8"));

  const user = process.env.USER_ADDRESS;
  const cid = process.env.CID;
  if (!user || !cid) throw new Error("Set USER_ADDRESS and CID");
  const amount = ethers.parseEther(process.env.AMOUNT || "10");

  const token = await ethers.getContractAt("CognitionToken", tokenAddress);
  const tx = await token.mintCognitiveReward(user, amount, cid);
  const receipt = await tx.wait();

  console.log(`Rewarded ${ethers.formatEther(amount)} COGN to ${user}`);
  console.log(`Receipt: ${receipt.hash} | reasoning CID: ${cid}`);
  console.log(`Mined so far: ${ethers.formatEther(await token.totalMined())} / 400000000 COGN`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
