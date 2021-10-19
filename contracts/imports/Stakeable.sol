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
    uint256 private _total;
    uint256 private _cumulativeTotal;
    uint256 private _lastBlockNumber;
    uint256 private _lockFactor;
    uint256 private _lockAverage;

    struct Stake {
        uint256 amount;
        uint256 blockNumber;
        uint256 lockBlocks;
        uint256 claimable;
    }

    function __Stakeable_init(address stakingToken, address stakingFund) internal initializer {
        _stakingToken = ERC777Upgradeable(stakingToken);
        _stakingFund = stakingFund;
    }

    /// Stakes the specified amount of tokens for the sender, and adds the details to a stored stake object
    function addStake(uint256 amount, uint256 lockBlocks) public {
        require(amount <= _stakingToken.balanceOf(msg.sender) - stakedBalanceOf(msg.sender), "Stakeable: stake amount exceeds unstaked balance");
        require(amount > 0, "Stakeable: stake amount must be nonzero");

        uint256 blockNumber = block.number;
        _stakes[msg.sender].push(Stake(amount, blockNumber, lockBlocks, 0));
        _totals[msg.sender] += amount;

        _updateTracking(int256(amount), _newCumulativeTotal(blockNumber), blockNumber, lockBlocks);

        emit Staked(msg.sender, amount, blockNumber);
    }

    /// Withdraws the specified amount of tokens from the sender's stake at the specified zero-based index
    function withdrawStake(uint256 index, uint256 amount) public virtual returns(uint256) {
        Stake[] memory stakes = _stakes[msg.sender];
        Stake memory stake = stakes[index];
        require(stake.amount >= amount, "Stakeable: cannot withdraw more than you have staked");

        uint256 blockNumber = block.number;
        require(stake.blockNumber + stake.lockBlocks < blockNumber, "Stakeable: cannot withdraw during lock blocks");

        (uint256 reward, uint256 newCumulativeTotal) = _rewardInfo(stake, amount, blockNumber);

        _updateTracking(-int256(amount), newCumulativeTotal, blockNumber, stake.lockBlocks);

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

        uint256 accuracy = 1000;
        uint256 lockBlocks = stake.lockBlocks;

        // Calculate a reward multiplier based on a sigmoid curve defined by 1 ÷ (1 + e⁻ˣ) where x is the stake's lock blocks delta from the average
        bytes16 one = ABDKMathQuad.fromUInt(1);
        uint256 multiplier = ABDKMathQuad.toUInt(
            ABDKMathQuad.mul(
                ABDKMathQuad.fromUInt(2 * accuracy),
                ABDKMathQuad.div(
                    one,
                    ABDKMathQuad.add(
                        one,
                        ABDKMathQuad.exp(
                            ABDKMathQuad.mul(
                                ABDKMathQuad.div(
                                    ABDKMathQuad.fromInt(-10), // Adjust to change the S-shape (higher value increases slope)
                                    ABDKMathQuad.fromUInt(_lockAverage)
                                ),
                                ABDKMathQuad.sub(
                                    ABDKMathQuad.fromUInt(lockBlocks),
                                    ABDKMathQuad.fromUInt(_lockAverage)
                                )
                            )
                        )
                    )
                )
            )
        );

        // Calculate the reward as a relative proportion of the cumulative total of all holders' stakes adjusted by the multiplier
        uint256 reward = cumulativeAmount == 0 ? 0 : (multiplier * _stakingToken.balanceOf(_stakingFund) * cumulativeAmount / newCumulativeTotal) / accuracy;

        // The returned new cumulative total should not include the amount being withdrawn
        newCumulativeTotal -= cumulativeAmount;

        return (reward, newCumulativeTotal);
    }

    function _reward(Stake memory stake, uint256 blockNumber) private view returns(uint256) {
        (uint256 reward,) = _rewardInfo(stake, stake.amount, blockNumber);
        return reward;
    }

    function _newCumulativeTotal(uint256 blockNumber) private view returns(uint256) {
        // Add the total of all stakes multiplied across all blocks since the previous calculation to the cumulative total
        return _cumulativeTotal + _total * (blockNumber - _lastBlockNumber);
    }

    function _updateTracking(int256 amountDelta, uint256 cumulativeTotal, uint256 blockNumber, uint256 lockBlocks) private {
        _cumulativeTotal = cumulativeTotal;
        _lastBlockNumber = blockNumber;
        _total = uint256(int256(_total) + amountDelta);

        // Calculate the weighted average of lock blocks using the stake amount as the weight - the multiplier sigmoid curve is centred around this value
        _lockFactor = uint256(int256(_lockFactor) + amountDelta * int256(lockBlocks));
        _lockAverage = _lockFactor / _total;
    }

    function stakedBalanceOf(address account) public view returns(uint256) {
        return _totals[account];
    }

    function stakingSummary() public view virtual returns(Stake[] memory) {
        Stake[] memory stakes = _stakes[msg.sender];
        uint256 blockNumber = block.number;

        for (uint256 i = 0; i < stakes.length; i++) {
            stakes[i].claimable = _reward(stakes[i], blockNumber);
        }

        return stakes;
    }

    event Staked(address indexed user, uint256 amount, uint256 blockNumber);

    event Withdrawn(address indexed user, uint256 index, uint256 amount, uint256 reward);
}
