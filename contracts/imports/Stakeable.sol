// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/ERC777Upgradeable.sol";
import "abdk-libraries-solidity/ABDKMathQuad.sol";

/// @author Jason Payne (https://twitter.com/Neo42)
/// @title A token staking superclass
/// Provides staking functionality to any token contract that inherits it
contract Stakeable is Initializable {
    ERC777Upgradeable private _stakingToken;
    address private _stakingFund;
    mapping(address => Stake[]) private _stakes;
    mapping(address => uint256) private _totals;
    uint256 private _totalTokens;
    uint256 private _cumulativeTotal;
    uint256 private _lastBlockNumber;
    uint256 private _totalStakeWeight;

    struct Stake {
        uint256 amount;
        uint256 blockNumber;
        uint256 vestingBlocks;
        uint256 claimable;
    }

    function __Stakeable_init(address stakingToken, address stakingFund) internal initializer {
        _stakingToken = ERC777Upgradeable(stakingToken);
        _stakingFund = stakingFund;
    }

    /// Stakes the specified amount of tokens for the sender, and adds the details to a stored stake object
    function addStake(uint256 amount, uint256 vestingBlocks) external {
        require(amount <= _stakingToken.balanceOf(msg.sender) - stakedBalanceOf(msg.sender), "Stakeable: stake amount exceeds unstaked balance");
        require(amount > 0, "Stakeable: stake amount must be nonzero");

        uint256 blockNumber = block.number;
        _stakes[msg.sender].push(Stake(amount, blockNumber, vestingBlocks, 0));
        _totals[msg.sender] += amount;

        _updateTracking(int256(amount), _newCumulativeTotal(blockNumber), blockNumber, vestingBlocks);

        emit Staked(msg.sender, amount, blockNumber);
    }

    /// Withdraws the specified amount of tokens from the sender's stake at the specified zero-based index
    function withdrawStake(uint256 index, uint256 amount) public virtual returns(uint256) {
        Stake[] memory stakes = _stakes[msg.sender];
        Stake memory stake = stakes[index];
        require(stake.amount >= amount, "Stakeable: cannot withdraw more than you have staked");

        uint256 blockNumber = block.number;
        require(stake.blockNumber + stake.vestingBlocks < blockNumber, "Stakeable: cannot withdraw during vesting blocks");

        (uint256 reward, uint256 newCumulativeTotal) = _rewardInfo(stake, amount, blockNumber);

        _updateTracking(-int256(amount), newCumulativeTotal, blockNumber, stake.vestingBlocks);

        _stakes[msg.sender][index].amount -= amount;
        _totals[msg.sender] -= amount;

        // Remove the stake if it is fully withdrawn by replacing it with the last stake in the array
        if (_stakes[msg.sender][index].amount == 0) {
            _stakes[msg.sender][index] = stakes[stakes.length - 1];
            _stakes[msg.sender].pop();
        }

        return reward;
    }

    function _rewardInfo(Stake memory stake, uint256 amount, uint256 blockNumber) private view returns(uint256, uint256) {
        // Calculate the stake amount multiplied across the number of blocks since the start of the stake
        uint256 cumulativeAmount = amount * (blockNumber - stake.blockNumber);

        // Get the new cumulative total of all stakes as the current stored value is from the previous staking activity
        uint256 newCumulativeTotal = _newCumulativeTotal(blockNumber);

        uint256 reward;

        if (cumulativeAmount > 0 && _totalStakeWeight > 0) {
            uint256 vestingBlocksWeightedAverage = _totalStakeWeight / _totalTokens;

            // Calculate a reward multiplier based on a sigmoid curve defined by 1 ÷ (1 + e⁻ˣ) where x is the stake's lock weight delta from the average
            bytes16 x = ABDKMathQuad.mul(
                ABDKMathQuad.div(
                    ABDKMathQuad.fromInt(-10), // Adjust to change the S-shape (higher value increases slope)
                    ABDKMathQuad.fromUInt(vestingBlocksWeightedAverage)
                ),
                ABDKMathQuad.sub(
                    ABDKMathQuad.fromUInt(stake.vestingBlocks),
                    ABDKMathQuad.fromUInt(vestingBlocksWeightedAverage)
                )
            );

            // Calculate the reward as a relative proportion of the cumulative total of all holders' stakes, adjusted by the multiplier
            uint256 accuracy = 1000;
            reward = (_multitplier(accuracy, x) * _stakingToken.balanceOf(_stakingFund) * cumulativeAmount / newCumulativeTotal) / accuracy;

            // The returned new cumulative total should not include the reward
            newCumulativeTotal -= cumulativeAmount;
        }

        return (reward, newCumulativeTotal);
    }

    function _multitplier(uint256 accuracy, bytes16 x) private pure returns(uint256) {
        bytes16 one = ABDKMathQuad.fromUInt(1);

        return ABDKMathQuad.toUInt(
            ABDKMathQuad.mul(
                ABDKMathQuad.fromUInt(accuracy),
                ABDKMathQuad.div(one, ABDKMathQuad.add(one, ABDKMathQuad.exp(x)))
            )
        );
    }

    function _reward(Stake memory stake, uint256 blockNumber) private view returns(uint256) {
        (uint256 reward,) = _rewardInfo(stake, stake.amount, blockNumber);
        return reward;
    }

    function _newCumulativeTotal(uint256 blockNumber) private view returns(uint256) {
        // Add the total of all stakes multiplied across all blocks since the previous calculation to the cumulative total
        return _cumulativeTotal + _totalTokens * (blockNumber - _lastBlockNumber);
    }

    function _updateTracking(int256 amountDelta, uint256 cumulativeTotal, uint256 blockNumber, uint256 vestingBlocks) private {
        _cumulativeTotal = cumulativeTotal;
        _lastBlockNumber = blockNumber;
        _totalTokens = uint256(int256(_totalTokens) + amountDelta);

        // Adjust the sum of products of staked tokens and vesting blocks to get a total weight - this is used to calculate the weighted average later
        _totalStakeWeight = uint256(int256(_totalStakeWeight) + amountDelta * int256(vestingBlocks));
    }

    function stakedBalanceOf(address account) public view returns(uint256) {
        return _totals[account];
    }

    function stakingSummary(address account) public view virtual returns(Stake[] memory) {
        Stake[] memory stakes = _stakes[account];
        uint256 blockNumber = block.number;

        for (uint256 i = 0; i < stakes.length; i++) {
            stakes[i].claimable = _reward(stakes[i], blockNumber);
        }

        return stakes;
    }

    event Staked(address indexed user, uint256 amount, uint256 blockNumber);

    event Withdrawn(address indexed user, uint256 index, uint256 amount, uint256 reward);
}
