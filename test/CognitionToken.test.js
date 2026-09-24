const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const ONE = 10n ** 18n;
const MAX_SUPPLY = 1_000_000_000n * ONE;
const INITIAL_ALLOCATION = 600_000_000n * ONE;
const MINING_ALLOCATION = 400_000_000n * ONE;

describe("CognitionToken", function () {
  async function deploy() {
    const [owner, oracle, user, other] = await ethers.getSigners();
    const token = await ethers.deployContract("CognitionToken", [owner.address, owner.address]);
    await token.setOracleAddress(oracle.address);
    return { token, owner, oracle, user, other };
  }

  it("mints the 600M TGE allocation and reserves 400M for mining", async function () {
    const { token, owner } = await loadFixture(deploy);
    expect(await token.totalSupply()).to.equal(INITIAL_ALLOCATION);
    expect(await token.balanceOf(owner.address)).to.equal(INITIAL_ALLOCATION);
    expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    expect(await token.remainingMiningSupply()).to.equal(MINING_ALLOCATION);
  });

  it("lets only the oracle emit rewards, with an IPFS receipt", async function () {
    const { token, oracle, owner, user } = await loadFixture(deploy);

    await expect(token.connect(owner).mintCognitiveReward(user.address, ONE, "bafy-1")).to.be.revertedWithCustomError(
      token,
      "NotOracle",
    );

    await expect(token.connect(oracle).mintCognitiveReward(user.address, 100n * ONE, "bafy-1"))
      .to.emit(token, "CognitiveRewardMinted")
      .withArgs(user.address, 100n * ONE, "bafy-1");

    expect(await token.balanceOf(user.address)).to.equal(100n * ONE);
    expect(await token.totalMined()).to.equal(100n * ONE);
  });

  it("rejects paying the same reasoning trace twice", async function () {
    const { token, oracle, user } = await loadFixture(deploy);
    await token.connect(oracle).mintCognitiveReward(user.address, ONE, "bafy-dup");
    await expect(token.connect(oracle).mintCognitiveReward(user.address, ONE, "bafy-dup"))
      .to.be.revertedWithCustomError(token, "ReasoningAlreadyRewarded")
      .withArgs("bafy-dup");
  });

  it("caps a single reward and lets the owner tune the circuit breaker", async function () {
    const { token, oracle, owner, user } = await loadFixture(deploy);
    const cap = await token.maxRewardPerMint();
    await expect(
      token.connect(oracle).mintCognitiveReward(user.address, cap + 1n, "bafy-big"),
    ).to.be.revertedWithCustomError(token, "RewardAboveCap");

    await token.connect(owner).setMaxRewardPerMint(cap * 2n);
    await token.connect(oracle).mintCognitiveReward(user.address, cap + 1n, "bafy-big");
    expect(await token.balanceOf(user.address)).to.equal(cap + 1n);
  });

  it("never exceeds the 400M mining allocation nor the 1B hard cap", async function () {
    const { token, oracle, user } = await loadFixture(deploy);
    await token.setMaxRewardPerMint(MINING_ALLOCATION);
    await token.connect(oracle).mintCognitiveReward(user.address, MINING_ALLOCATION, "bafy-all");

    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    expect(await token.remainingMiningSupply()).to.equal(0);
    await expect(
      token.connect(oracle).mintCognitiveReward(user.address, ONE, "bafy-extra"),
    ).to.be.revertedWithCustomError(token, "MiningAllocationExhausted");
  });

  it("burning does not re-open mining room", async function () {
    const { token, oracle, user } = await loadFixture(deploy);
    await token.setMaxRewardPerMint(MINING_ALLOCATION);
    await token.connect(oracle).mintCognitiveReward(user.address, MINING_ALLOCATION, "bafy-all");
    await token.connect(user).burn(1000n * ONE);

    await expect(
      token.connect(oracle).mintCognitiveReward(user.address, ONE, "bafy-after-burn"),
    ).to.be.revertedWithCustomError(token, "MiningAllocationExhausted");
  });

  it("settles a batch of validated reasoning in one transaction", async function () {
    const { token, oracle, user, other } = await loadFixture(deploy);
    await token.connect(oracle).mintCognitiveRewardBatch(
      [user.address, other.address],
      [10n * ONE, 20n * ONE],
      ["bafy-a", "bafy-b"],
    );
    expect(await token.balanceOf(user.address)).to.equal(10n * ONE);
    expect(await token.balanceOf(other.address)).to.equal(20n * ONE);
    expect(await token.totalMined()).to.equal(30n * ONE);
  });

  it("only the owner can rotate the oracle", async function () {
    const { token, other } = await loadFixture(deploy);
    await expect(token.connect(other).setOracleAddress(other.address)).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount",
    );
    await expect(token.setOracleAddress(other.address)).to.emit(token, "OracleUpdated");
    expect(await token.oracleAddress()).to.equal(other.address);
  });
});
