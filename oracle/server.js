// CalchAI Oracle service: the only wallet allowed to emit $COGN.
// In production this is where the Vertex AI evaluator decides whether a reasoning
// trace deserves a reward and pins it to IPFS. Here the scoring is stubbed so the
// demo can show the full loop: reasoning -> score -> CID -> on-chain reward.
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, Wallet, Contract, parseEther, isAddress, toUtf8Bytes, keccak256 } = require("ethers");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ABI = [
  "function mintCognitiveReward(address user, uint256 amount, string reasoningCid) external",
  "function oracleAddress() view returns (address)",
  "function maxRewardPerMint() view returns (uint256)",
  "function rewardedReasoning(bytes32) view returns (bool)",
];

const deployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployments", "monadTestnet.json"), "utf8"),
);

const provider = new JsonRpcProvider(process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz/");
const oracle = new Wallet(process.env.ORACLE_PRIVATE_KEY, provider);
const token = new Contract(deployment.token, ABI, oracle);

// Stub of the Proof of Reasoning evaluator: rewards depth, structure and verifiability.
function scoreReasoning(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const steps = (text.match(/\n\s*(\d+\.|-|\*)/g) || []).length;
  const hasConclusion = /(por lo tanto|therefore|conclusi[oó]n|luego)/i.test(text);
  const raw = Math.min(words / 120, 1) * 0.5 + Math.min(steps / 5, 1) * 0.3 + (hasConclusion ? 0.2 : 0);
  return Math.round(raw * 100);
}

// Deterministic stand-in for pinning the trace to IPFS.
function fakeCid(text) {
  const { createHash } = require("crypto");
  return `bafy${createHash("sha256").update(text).digest("hex").slice(0, 46)}`;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  res.json({
    oracle: oracle.address,
    onChainOracle: await token.oracleAddress(),
    token: deployment.token,
    vesting: deployment.vesting,
    chainId: deployment.chainId,
  });
});

app.post("/evaluate", async (req, res) => {
  const { user, reasoning } = req.body || {};
  if (!isAddress(user || "")) return res.status(400).json({ error: "invalid user address" });
  if (!reasoning || reasoning.trim().length < 20) {
    return res.status(400).json({ error: "reasoning too short to be worth rewarding" });
  }

  const score = scoreReasoning(reasoning);
  if (score < 40) {
    return res.json({ rewarded: false, score, reason: "score below the 40 quality threshold" });
  }

  const cid = fakeCid(reasoning);
  const amount = parseEther(String(score / 10)); // up to 10 COGN per trace

  if (await token.rewardedReasoning(keccak256(toUtf8Bytes(cid)))) {
    return res.status(409).json({
      rewarded: false,
      score,
      cid,
      reason: "this reasoning trace was already rewarded on-chain (duplicate CID)",
    });
  }

  try {
    const tx = await token.mintCognitiveReward(user, amount, cid);
    const receipt = await tx.wait();
    res.json({
      rewarded: true,
      score,
      cid,
      amount: score / 10,
      txHash: receipt.hash,
      explorer: `https://testnet.monadexplorer.com/tx/${receipt.hash}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.shortMessage || error.message, score, cid });
  }
});

const port = process.env.ORACLE_PORT || 8787;
app.listen(port, () => console.log(`Oracle service on :${port} as ${oracle.address}`));
