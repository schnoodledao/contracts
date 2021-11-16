// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

/// @author Jason Payne (https://twitter.com/Neo42)
/// Delivers Lambo posthaste
contract SchnoodleStakingV1 is Initializable, OwnableUpgradeable {
    address private _schnoodle;
    mapping(address => Stake[]) private _accountStakes;
    mapping(address => Unbond[]) private _accountUnbonds;
    mapping(address => uint256) private _balances;
    uint256 private _totalTokens;
    uint256 private _cumulativeTotal;
    uint256 private _checkpointBlock;
    uint256 private _totalStakeWeight;

    // Adjust to change the sigmoid curve of the multiplier
    SigmoidParams private _sigmoidParams;

    struct Stake {
        uint256 amount;
        uint256 blockNumber;
        uint256 vestingBlocks;
        uint256 unbondingBlocks;
    }

    struct StakeReward {
        Stake stake;
        uint256 reward;
    }

    struct Unbond {
        uint256 amount;
        uint256 expiryBlock;
    }

    struct SigmoidParams {
        uint256 k; // Higher value increases slope severity
        uint256 a; // Higher value increases slope severity and shifts right
    }

    function initialize(address schnoodle) public initializer {
        __Ownable_init();
        _schnoodle = schnoodle;
        _sigmoidParams = SigmoidParams(5, 1);
    }

    /// Stakes the specified amount of tokens for the sender, and adds the details to a stored stake object
    function addStake(uint256 amount, uint256 vestingBlocks, uint256 unbondingBlocks) external {
        address msgSender = _msgSender();

        require(amount <= balanceOf(msgSender) - stakedBalanceOf(msgSender), "SchnoodleStaking: stake amount exceeds unstaked balance");
        require(amount > 0, "Stake must be nonzero");

        (Stake memory stake, uint256 cumulativeTotal) = _addStake(amount, vestingBlocks, unbondingBlocks);
        _accountStakes[msgSender].push(Stake(amount, stake.blockNumber, vestingBlocks, unbondingBlocks));
        _balances[msgSender] += amount;

        _updateTracking(int256(amount), vestingBlocks, unbondingBlocks, cumulativeTotal, stake.blockNumber);

        emit Staked(msgSender, amount, stake.blockNumber);
    }

    function _addStake(uint256 amount, uint256 vestingBlocks, uint256 unbondingBlocks) private view returns (Stake memory, uint256) {
        uint256 blockNumber = block.number;
        return (Stake(amount, blockNumber, vestingBlocks, unbondingBlocks), _newCumulativeTotal(blockNumber));
    }

    /// Withdraws the specified amount of tokens from the sender's stake at the specified zero-based index
    function withdraw(uint256 index, uint256 amount) external {
        address msgSender = _msgSender();
        Stake[] storage stakes = _accountStakes[msgSender];
        Stake storage stake = stakes[index];
        require(stake.amount >= amount, "SchnoodleStaking: cannot withdraw more than staked");

        uint256 rewardBlock = block.number;
        require(stake.blockNumber + stake.vestingBlocks < rewardBlock, "SchnoodleStaking: cannot withdraw during vesting blocks");

        (uint256 netReward, uint256 grossReward, uint256 newCumulativeTotal) = _rewardInfo(stake, amount, rewardBlock);

        _updateTracking(-int256(amount), stake.vestingBlocks, stake.unbondingBlocks, newCumulativeTotal, rewardBlock);

        stake.amount -= amount;
        _balances[msgSender] -= amount;
        _accountUnbonds[msgSender].push(Unbond(amount, rewardBlock + stake.unbondingBlocks));

        // Remove the stake if it is fully withdrawn by replacing it with the last stake in the array
        if (stake.amount == 0) {
            stakes[index] = stakes[stakes.length - 1];
            stakes.pop();
        }

        stakingReward(msgSender, netReward, grossReward);

        emit Withdrawn(msgSender, index, amount, netReward, grossReward);
    }

    function changeSigmoidParams(uint256 k, uint256 a) external onlyOwner {
        _sigmoidParams = SigmoidParams(k, a);
    }

    function sigmoidParams() external view returns(SigmoidParams memory) {
        return _sigmoidParams;
    }

    function reward(uint256 amount, uint256 vestingBlocks, uint256 unbondingBlocks, uint256 rewardBlock) external view returns(uint256) {
        (Stake memory stake, uint256 cumulativeTotal) = _addStake(amount, vestingBlocks, unbondingBlocks);
        (uint256 totalTokens, uint256 totalStakeWeight) = _updateTracking(int256(amount), vestingBlocks, unbondingBlocks);
        return _reward(stake, stake.blockNumber, rewardBlock, cumulativeTotal, totalStakeWeight, totalTokens);
    }

    function reward(uint256 index, uint256 rewardBlock) external view returns(uint256) {
        return _reward(_accountStakes[_msgSender()][index], rewardBlock);
    }

    function _reward(Stake memory stake, uint256 rewardBlock) private view returns(uint256) {
        return _reward(stake, _checkpointBlock, rewardBlock, _cumulativeTotal, _totalStakeWeight, _totalTokens);
    }

    function _reward(Stake memory stake, uint256 checkpointBlock, uint256 rewardBlock, uint256 cumulativeTotal, uint256 totalStakeWeight, uint256 totalTokens) private view returns(uint256) {
        (uint256 netReward,,) = _rewardInfo(stake, stake.amount, checkpointBlock, rewardBlock, cumulativeTotal, totalStakeWeight, totalTokens);
        return netReward;
    }

    function _rewardInfo(Stake memory stake, uint256 amount, uint256 rewardBlock) private view returns(uint256, uint256, uint256) {
        return _rewardInfo(stake, amount, _checkpointBlock, rewardBlock, _cumulativeTotal, _totalStakeWeight, _totalTokens);
    }

    function _rewardInfo(Stake memory stake, uint256 amount, uint256 checkpointBlock, uint256 rewardBlock, uint256 cumulativeTotal, uint256 totalStakeWeight, uint256 totalTokens) private view returns(uint256, uint256, uint256) {
        // Calculate the stake amount multiplied across the number of blocks since the start of the stake
        uint256 cumulativeAmount = amount * (rewardBlock - stake.blockNumber);

        // Get the new cumulative total of all stakes as the current stored value is from the previous staking activity
        uint256 newCumulativeTotal = _newCumulativeTotal(checkpointBlock, rewardBlock, cumulativeTotal, totalTokens);

        uint256 grossReward;
        uint256 netReward;

        if (cumulativeAmount > 0 && totalStakeWeight > 0) {
            uint256 lockProduct = stake.vestingBlocks * stake.unbondingBlocks;
            uint256 lockProductWeightedAverage = totalStakeWeight / totalTokens;

            // Calculate a reward multiplier based on a sigmoid curve defined by logistic function 1 ÷ (1 + e⁻ˣ) where x is the stake's lock product delta from the weighted average
            int128 x = ABDKMath64x64.mul(
                ABDKMath64x64.div(
                    ABDKMath64x64.fromInt(-int256(_sigmoidParams.k)),
                    ABDKMath64x64.fromUInt(lockProductWeightedAverage)
                ),
                ABDKMath64x64.fromInt(int256(lockProduct) - int256(lockProductWeightedAverage))
            );

            // Calculate the reward as a relative proportion of the cumulative total of all holders' stakes, adjusted by the multiplier
            uint256 accuracy = 1000;
            grossReward = balanceOf(stakingFund()) * cumulativeAmount / newCumulativeTotal;
            netReward = (_multitplier(accuracy, x) * grossReward) / accuracy;

            // The returned new cumulative total should not include the reward
            newCumulativeTotal -= cumulativeAmount;
        }

        return (netReward, grossReward, newCumulativeTotal);
    }

    function _multitplier(uint256 accuracy, int128 x) private view returns(uint256) {
        int128 one = ABDKMath64x64.fromUInt(1);

        return ABDKMath64x64.toUInt(
            ABDKMath64x64.mul(
                ABDKMath64x64.fromUInt(accuracy),
                ABDKMath64x64.div(one,
                    ABDKMath64x64.add(
                        one,
                        ABDKMath64x64.pow(
                            ABDKMath64x64.exp(x),
                            _sigmoidParams.a
                        )
                    )
                )
            )
        );
    }

    function _newCumulativeTotal(uint256 rewardBlock) private view returns(uint256) {
        return _newCumulativeTotal(_checkpointBlock, rewardBlock, _cumulativeTotal, _totalTokens);
    }

    function _newCumulativeTotal(uint256 checkpointBlock, uint256 rewardBlock, uint256 cumulativeTotal, uint256 totalTokens) private pure returns(uint256) {
        // Add the total of all stakes multiplied across all blocks since the previous checkpoint calculation to the cumulative total
        return cumulativeTotal + totalTokens * (rewardBlock - checkpointBlock);
    }

    function _updateTracking(int256 amountDelta, uint256 vestingBlocks, uint256 unbondingBlocks, uint256 cumulativeTotal, uint256 checkpointBlock) private {
        (_totalTokens, _totalStakeWeight) = _updateTracking(amountDelta, vestingBlocks, unbondingBlocks);
        _cumulativeTotal = cumulativeTotal;
        _checkpointBlock = checkpointBlock;
    }

    function _updateTracking(int256 amountDelta, uint256 vestingBlocks, uint256 unbondingBlocks) private view returns(uint256, uint256) {
        return (
            uint256(int256(_totalTokens) + amountDelta), // Update total tokens
            uint256(int256(_totalStakeWeight) + amountDelta * int256(vestingBlocks) * int256(unbondingBlocks)) // Update total stake weight
        );
    }

    function stakedBalanceOf(address account) public view returns(uint256) {
        return _balances[account];
    }

    function unbondingBalanceOf(address account) public returns(uint256) {
        uint256 blockNumber = block.number;
        uint256 total;
        Unbond[] storage unbonds = _accountUnbonds[account];

        for (uint256 i = 0; i < unbonds.length; i++) {
            Unbond memory unbond = unbonds[i];
            if (unbond.expiryBlock > blockNumber) {
                total += unbond.amount;
            } else {
                // The unbond has expired, so remove it from the array
                unbonds[i--] = unbonds[unbonds.length - 1];
                unbonds.pop();
            }
        }

        return total;
    }

    function lockedBalanceOf(address account) external returns (uint256) {
        return unbondingBalanceOf(account) + stakedBalanceOf(account);
    }

    function stakingSummary(address account) public view returns(StakeReward[] memory) {
        Stake[] storage stakes = _accountStakes[account];
        StakeReward[] memory stakeRewards = new StakeReward[](stakes.length);
        uint256 rewardBlock = block.number;

        for (uint256 i = 0; i < stakes.length; i++) {
            stakeRewards[i] = StakeReward(stakes[i], _reward(stakes[i], rewardBlock));
        }

        return stakeRewards;
    }

    function unbondingSummary(address account) public view returns(Unbond[] memory) {
        return _accountUnbonds[account];
    }

    // Calls to the Schnoodle proxy contract

    function stakingFund() private view returns (address) {
        (bool success, bytes memory result) = _schnoodle.staticcall(abi.encodeWithSignature("stakingFund()"));
        assert(success);
        return abi.decode(result, (address));
    }

    function balanceOf(address account) private view returns(uint256) {
        (bool success, bytes memory result) = _schnoodle.staticcall(abi.encodeWithSignature("balanceOf(address)", account));
        assert(success);
        return abi.decode(result, (uint256));
    }

    function stakingReward(address account, uint256 netReward, uint256 grossReward) private {
        (bool success,) = _schnoodle.call(abi.encodeWithSignature("stakingReward(address,uint256,uint256)", account, netReward, grossReward));
        assert(success);
    }

    // Events

    event Staked(address indexed account, uint256 amount, uint256 blockNumber);

    event Withdrawn(address indexed account, uint256 index, uint256 amount, uint256 netReward, uint256 grossReward);
}
