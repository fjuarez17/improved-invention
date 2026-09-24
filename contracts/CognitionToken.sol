// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title Cognition Token ($COGN) - the economic engine of CalchAI's Proof of Reasoning market.
/// @notice Fixed hard cap of 1,000,000,000 COGN. 600M is allocated at TGE (treasury, team,
///         investors, airdrop) and 400M can only ever be emitted as cognitive mining rewards
///         by the CalchAI oracle, each one anchored to an IPFS reasoning receipt.
contract CognitionToken is ERC20, ERC20Burnable, ERC20Permit, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    uint256 public constant TREASURY_ALLOCATION = 200_000_000 * 1e18; // 20%
    uint256 public constant TEAM_ALLOCATION = 150_000_000 * 1e18; // 15%
    uint256 public constant INVESTORS_ALLOCATION = 150_000_000 * 1e18; // 15%
    uint256 public constant AIRDROP_ALLOCATION = 100_000_000 * 1e18; // 10%
    uint256 public constant INITIAL_ALLOCATION =
        TREASURY_ALLOCATION + TEAM_ALLOCATION + INVESTORS_ALLOCATION + AIRDROP_ALLOCATION; // 600M

    /// @notice Tokens reserved exclusively for algorithmic cognitive mining (40%).
    uint256 public constant MINING_ALLOCATION = MAX_SUPPLY - INITIAL_ALLOCATION; // 400M

    /// @notice Total amount already emitted through cognitive mining.
    uint256 public totalMined;

    /// @notice Backend wallet (CalchAI reasoning evaluator) allowed to emit mining rewards.
    address public oracleAddress;

    /// @notice Upper bound for a single reward, a circuit breaker against a compromised oracle.
    uint256 public maxRewardPerMint = 1_000 * 1e18;

    /// @notice IPFS CIDs already rewarded, so the same reasoning trace cannot be paid twice.
    mapping(bytes32 => bool) public rewardedReasoning;

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event MaxRewardPerMintUpdated(uint256 oldValue, uint256 newValue);
    event CognitiveRewardMinted(address indexed user, uint256 amount, string reasoningCid);

    error NotOracle();
    error ZeroAddress();
    error InvalidAmount();
    error MiningAllocationExhausted();
    error RewardAboveCap();
    error ReasoningAlreadyRewarded(string reasoningCid);

    modifier onlyOracle() {
        if (msg.sender != oracleAddress) revert NotOracle();
        _;
    }

    /// @param initialOwner Multisig that owns the protocol and custodies the TGE allocation.
    /// @param allocationReceiver Address receiving the 600M TGE allocation (vesting vault or treasury multisig).
    constructor(address initialOwner, address allocationReceiver)
        ERC20("Cognition", "COGN")
        ERC20Permit("Cognition")
        Ownable(initialOwner)
    {
        if (allocationReceiver == address(0)) revert ZeroAddress();
        _mint(allocationReceiver, INITIAL_ALLOCATION);
    }

    function setOracleAddress(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracleAddress, _oracle);
        oracleAddress = _oracle;
    }

    function setMaxRewardPerMint(uint256 _maxReward) external onlyOwner {
        if (_maxReward == 0) revert InvalidAmount();
        emit MaxRewardPerMintUpdated(maxRewardPerMint, _maxReward);
        maxRewardPerMint = _maxReward;
    }

    /// @notice Remaining tokens that can still be mined by solving and reasoning.
    function remainingMiningSupply() external view returns (uint256) {
        return MINING_ALLOCATION - totalMined;
    }

    /// @notice Emits a cognitive mining reward, cryptographically receipted by an IPFS CID.
    /// @param user Student or agent whose reasoning trace was validated.
    /// @param amount Reward size, bounded by `maxRewardPerMint`.
    /// @param reasoningCid IPFS CID of the reasoning trace that justifies this emission.
    function mintCognitiveReward(address user, uint256 amount, string calldata reasoningCid) external onlyOracle {
        _mintCognitiveReward(user, amount, reasoningCid);
    }

    /// @notice Batch variant so the backend can settle an epoch of validated reasoning in one tx.
    function mintCognitiveRewardBatch(
        address[] calldata users,
        uint256[] calldata amounts,
        string[] calldata reasoningCids
    ) external onlyOracle {
        uint256 len = users.length;
        if (len != amounts.length || len != reasoningCids.length) revert InvalidAmount();
        for (uint256 i; i < len; ++i) {
            _mintCognitiveReward(users[i], amounts[i], reasoningCids[i]);
        }
    }

    function _mintCognitiveReward(address user, uint256 amount, string calldata reasoningCid) private {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > maxRewardPerMint) revert RewardAboveCap();
        if (bytes(reasoningCid).length == 0) revert InvalidAmount();

        bytes32 cidHash = keccak256(bytes(reasoningCid));
        if (rewardedReasoning[cidHash]) revert ReasoningAlreadyRewarded(reasoningCid);
        if (totalMined + amount > MINING_ALLOCATION) revert MiningAllocationExhausted();

        rewardedReasoning[cidHash] = true;
        totalMined += amount;

        _mint(user, amount);
        emit CognitiveRewardMinted(user, amount, reasoningCid);
    }
}
