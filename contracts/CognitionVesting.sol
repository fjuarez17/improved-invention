// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title CognitionVesting - TGE unlock + cliff + linear vesting vault for $COGN.
/// @notice A beneficiary can hold several schedules (e.g. team and investor allocations).
///         Schedules are irrevocable once created, which is what proves to investors and judges
///         that the team cannot dump its allocation.
contract CognitionVesting is Ownable2Step {
    using SafeERC20 for IERC20;

    struct Schedule {
        address beneficiary;
        uint256 total; // total tokens locked into this schedule
        uint256 tgeAmount; // released immediately at start
        uint256 released; // already claimed
        uint64 start; // TGE timestamp
        uint64 cliff; // seconds after start with zero linear release
        uint64 duration; // linear vesting duration in seconds, after the cliff
        string category; // label, e.g. "Founding Team"
    }

    IERC20 public immutable token;

    Schedule[] private _schedules;
    mapping(address => uint256[]) private _schedulesOf;

    /// @notice Tokens deposited into the vault and committed to schedules.
    uint256 public totalCommitted;
    uint256 public totalReleased;

    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        string category,
        uint256 total,
        uint256 tgeAmount,
        uint64 start,
        uint64 cliff,
        uint64 duration
    );
    event TokensReleased(uint256 indexed scheduleId, address indexed beneficiary, uint256 amount);

    error ZeroAddress();
    error InvalidSchedule();
    error NothingToRelease();
    error InsufficientBalance();

    constructor(address tokenAddress, address initialOwner) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20(tokenAddress);
    }

    /// @notice Locks `total` tokens for `beneficiary`. Tokens must already be held by this vault.
    /// @param tgeAmount Portion unlocked at `start` (0% for team and investors in the CalchAI model).
    /// @param cliff Seconds after `start` during which nothing beyond the TGE portion vests.
    /// @param duration Linear vesting period, measured from the end of the cliff.
    function createSchedule(
        address beneficiary,
        string calldata category,
        uint256 total,
        uint256 tgeAmount,
        uint64 start,
        uint64 cliff,
        uint64 duration
    ) external onlyOwner returns (uint256 scheduleId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (total == 0 || tgeAmount > total) revert InvalidSchedule();
        if (duration == 0 && tgeAmount != total) revert InvalidSchedule();
        if (token.balanceOf(address(this)) < totalCommitted - totalReleased + total) revert InsufficientBalance();

        scheduleId = _schedules.length;
        _schedules.push(
            Schedule({
                beneficiary: beneficiary,
                total: total,
                tgeAmount: tgeAmount,
                released: 0,
                start: start,
                cliff: cliff,
                duration: duration,
                category: category
            })
        );
        _schedulesOf[beneficiary].push(scheduleId);
        totalCommitted += total;

        emit ScheduleCreated(scheduleId, beneficiary, category, total, tgeAmount, start, cliff, duration);
    }

    function scheduleCount() external view returns (uint256) {
        return _schedules.length;
    }

    function getSchedule(uint256 scheduleId) external view returns (Schedule memory) {
        if (scheduleId >= _schedules.length) revert InvalidSchedule();
        return _schedules[scheduleId];
    }

    function scheduleIdsOf(address beneficiary) external view returns (uint256[] memory) {
        return _schedulesOf[beneficiary];
    }

    /// @notice Total amount vested for a schedule at the current block timestamp.
    function vestedAmount(uint256 scheduleId) public view returns (uint256) {
        if (scheduleId >= _schedules.length) revert InvalidSchedule();
        Schedule memory s = _schedules[scheduleId];
        if (block.timestamp < s.start) return 0;

        uint256 linearTotal = s.total - s.tgeAmount;
        uint256 cliffEnd = uint256(s.start) + s.cliff;
        if (block.timestamp < cliffEnd || linearTotal == 0) return s.tgeAmount;

        uint256 elapsed = block.timestamp - cliffEnd;
        if (elapsed >= s.duration) return s.total;
        return s.tgeAmount + (linearTotal * elapsed) / s.duration;
    }

    function releasableAmount(uint256 scheduleId) public view returns (uint256) {
        return vestedAmount(scheduleId) - _schedules[scheduleId].released;
    }

    /// @notice Total claimable right now across every schedule of `beneficiary`.
    function releasableAmountOf(address beneficiary) external view returns (uint256 amount) {
        uint256[] memory ids = _schedulesOf[beneficiary];
        for (uint256 i; i < ids.length; ++i) {
            amount += releasableAmount(ids[i]);
        }
    }

    /// @notice Claims every token vested so far for a schedule. Callable by anyone.
    function release(uint256 scheduleId) public {
        uint256 amount = releasableAmount(scheduleId);
        if (amount == 0) revert NothingToRelease();

        Schedule storage s = _schedules[scheduleId];
        s.released += amount;
        totalReleased += amount;
        token.safeTransfer(s.beneficiary, amount);

        emit TokensReleased(scheduleId, s.beneficiary, amount);
    }

    /// @notice Claims across every schedule of `beneficiary` in one transaction.
    function releaseAll(address beneficiary) external {
        uint256[] memory ids = _schedulesOf[beneficiary];
        uint256 claimed;
        for (uint256 i; i < ids.length; ++i) {
            if (releasableAmount(ids[i]) > 0) {
                release(ids[i]);
                claimed++;
            }
        }
        if (claimed == 0) revert NothingToRelease();
    }

    /// @notice Withdraws tokens that were sent to the vault but never committed to a schedule.
    function sweepUncommitted(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 uncommitted = token.balanceOf(address(this)) - (totalCommitted - totalReleased);
        if (amount > uncommitted) revert InsufficientBalance();
        token.safeTransfer(to, amount);
    }
}
