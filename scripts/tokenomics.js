const { parseEther } = require("ethers");

const MONTH = 30 * 24 * 60 * 60;

// Distribution of the 1,000,000,000 $COGN hard cap.
// Cognitive Mining (40%) is not pre-minted: it is emitted by the oracle as reasoning is validated.
const ALLOCATIONS = {
  treasury: {
    label: "Treasury / Ecosystem",
    amount: parseEther("200000000"), // 20%
    tgeBps: 500, // 5% unlocked at TGE
    cliff: 3 * MONTH,
    duration: 36 * MONTH,
  },
  team: {
    label: "Founding Team",
    amount: parseEther("150000000"), // 15%
    tgeBps: 0,
    cliff: 12 * MONTH,
    duration: 48 * MONTH,
  },
  investors: {
    label: "Investors",
    amount: parseEther("150000000"), // 15%
    tgeBps: 0,
    cliff: 6 * MONTH,
    duration: 24 * MONTH,
  },
  airdrop: {
    label: "Airdrop / Testnet",
    amount: parseEther("100000000"), // 10%
    tgeBps: 10000, // fully liquid for early users
    cliff: 0,
    duration: 0,
  },
};

const tgeAmount = (allocation) => (allocation.amount * BigInt(allocation.tgeBps)) / 10000n;

module.exports = { MONTH, ALLOCATIONS, tgeAmount };
