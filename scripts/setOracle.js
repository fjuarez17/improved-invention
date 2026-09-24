// Points the token at the backend oracle wallet:
//   ORACLE_ADDRESS=0x... npx hardhat run scripts/setOracle.js --network monadTestnet
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const oracle = process.env.ORACLE_ADDRESS;
  if (!oracle) throw new Error("Set ORACLE_ADDRESS");

  const token = await ethers.getContractAt("CognitionToken", deployment.token);
  await (await token.setOracleAddress(oracle)).wait();
  console.log(`Oracle: ${await token.oracleAddress()}`);

  deployment.oracle = oracle;
  deployment.wallets.oracle = oracle;
  fs.writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
