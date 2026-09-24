const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ALLOCATIONS, tgeAmount, MONTH } = require("../scripts/tokenomics");

describe("CognitionVesting", function () {
  async function deploy() {
    const [owner, team, investor, treasury] = await ethers.getSigners();
    const token = await ethers.deployContract("CognitionToken", [owner.address, owner.address]);
    const vesting = await ethers.deployContract("CognitionVesting", [await token.getAddress(), owner.address]);
    const locked = ALLOCATIONS.treasury.amount + ALLOCATIONS.team.amount + ALLOCATIONS.investors.amount;
    await token.transfer(await vesting.getAddress(), locked);
    const start = await time.latest();

    const schedule = async (beneficiary, key) => {
      const a = ALLOCATIONS[key];
      await vesting.createSchedule(beneficiary, a.label, a.amount, tgeAmount(a), start, a.cliff, a.duration);
      return (await vesting.scheduleIdsOf(beneficiary)).at(-1);
    };

    return { token, vesting, owner, team, investor, treasury, start, schedule };
  }

  it("keeps the founding team fully locked through the 12 month cliff", async function () {
    const { vesting, team, start, schedule } = await loadFixture(deploy);
    const id = await schedule(team.address, "team");

    expect(await vesting.vestedAmount(id)).to.equal(0);
    await time.increaseTo(start + 12 * MONTH - 1);
    expect(await vesting.vestedAmount(id)).to.equal(0);
    await expect(vesting.release(id)).to.be.revertedWithCustomError(vesting, "NothingToRelease");
  });

  it("vests the team linearly over 48 months after the cliff", async function () {
    const { token, vesting, team, start, schedule } = await loadFixture(deploy);
    const a = ALLOCATIONS.team;
    const id = await schedule(team.address, "team");

    await time.increaseTo(start + a.cliff + a.duration / 2);
    expect(await vesting.releasableAmount(id)).to.be.closeTo(a.amount / 2n, ethers.parseEther("100"));

    await vesting.release(id);
    expect(await token.balanceOf(team.address)).to.be.closeTo(a.amount / 2n, ethers.parseEther("100"));

    await time.increaseTo(start + a.cliff + a.duration + 1);
    await vesting.release(id);
    expect(await token.balanceOf(team.address)).to.equal(a.amount);
    await expect(vesting.release(id)).to.be.revertedWithCustomError(vesting, "NothingToRelease");
  });

  it("gives the treasury its 5% TGE unlock immediately and nothing more until the cliff", async function () {
    const { token, vesting, treasury, start, schedule } = await loadFixture(deploy);
    const a = ALLOCATIONS.treasury;
    const tge = tgeAmount(a);
    const id = await schedule(treasury.address, "treasury");

    expect(await vesting.releasableAmount(id)).to.equal(tge);
    await vesting.release(id);
    expect(await token.balanceOf(treasury.address)).to.equal(tge);

    await time.increaseTo(start + a.cliff - 10);
    expect(await vesting.releasableAmount(id)).to.equal(0);

    await time.increaseTo(start + a.cliff + a.duration);
    expect(await vesting.releasableAmount(id)).to.equal(a.amount - tge);
  });

  it("vests investors over 24 months after a 6 month cliff", async function () {
    const { vesting, investor, start, schedule } = await loadFixture(deploy);
    const a = ALLOCATIONS.investors;
    const id = await schedule(investor.address, "investors");

    await time.increaseTo(start + a.cliff + a.duration / 4);
    expect(await vesting.vestedAmount(id)).to.be.closeTo(a.amount / 4n, ethers.parseEther("100"));
  });

  it("supports several schedules per wallet and claims them together", async function () {
    const { token, vesting, team, start, schedule } = await loadFixture(deploy);
    await schedule(team.address, "team");
    await schedule(team.address, "investors");
    expect(await vesting.scheduleCount()).to.equal(2);

    await time.increaseTo(start + ALLOCATIONS.investors.cliff + ALLOCATIONS.investors.duration);
    const releasable = await vesting.releasableAmountOf(team.address);
    await vesting.releaseAll(team.address);
    expect(await token.balanceOf(team.address)).to.be.closeTo(releasable, ethers.parseEther("100"));
    expect(releasable).to.be.gt(ALLOCATIONS.investors.amount);
  });

  it("rejects schedules that are not backed by tokens in the vault", async function () {
    const { vesting, team, start } = await loadFixture(deploy);
    const tooMuch = ethers.parseEther("600000000");
    await expect(
      vesting.createSchedule(team.address, "Oversized", tooMuch, 0, start, MONTH, MONTH),
    ).to.be.revertedWithCustomError(vesting, "InsufficientBalance");
  });

  it("only sweeps tokens that are not committed to a schedule", async function () {
    const { token, vesting, owner, team, schedule } = await loadFixture(deploy);
    await schedule(team.address, "team");

    const uncommitted = ALLOCATIONS.treasury.amount + ALLOCATIONS.investors.amount;
    await expect(
      vesting.sweepUncommitted(owner.address, uncommitted + 1n),
    ).to.be.revertedWithCustomError(vesting, "InsufficientBalance");

    const before = await token.balanceOf(owner.address);
    await vesting.sweepUncommitted(owner.address, uncommitted);
    expect(await token.balanceOf(owner.address)).to.equal(before + uncommitted);
  });

  it("only the owner can create schedules", async function () {
    const { vesting, team, start } = await loadFixture(deploy);
    await expect(
      vesting
        .connect(team)
        .createSchedule(team.address, "Rogue", ethers.parseEther("1"), 0, start, MONTH, MONTH),
    ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
  });
});
