// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./imports/Stakeable.sol";
import "./imports/SchnoodleV5Base.sol";

contract SchnoodleV5 is SchnoodleV5Base, AccessControlUpgradeable, Stakeable {
    address private _stakingPool;
    address private _stakingFund;
    uint256 private _stakingPercent;

    bytes32 public constant FEE_EXEMPT = keccak256("FEE_EXEMPT");
    bytes32 public constant NO_TRANSFER = keccak256("NO_TRANSFER");

    function initialize(uint256 initialTokens, address serviceAccount) public initializer {
        __SchnoodleV5Base_init(initialTokens, serviceAccount);
        _stakingFund = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
        __Stakeable_init(address(this), _stakingFund);
    }

    function payFeeAndDonate(address sender, address recipient, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual override {
        if (!hasRole(FEE_EXEMPT, sender)) {
            super.payFeeAndDonate(sender, recipient, amount, reflectedAmount, transferCallback);
            _transferTax(recipient, _stakingFund, amount, _stakingPercent, transferCallback);
        }
    }

    function stakingFund() public view returns (address) {
        return _stakingFund;
    }

    function changeStaking(address stakingPool, uint256 percent) public onlyOwner {
        _stakingPool = stakingPool;
        _stakingPercent = percent;
        emit StakingChanged(stakingPool, percent);
    }

    function staking() public view returns(address, uint256) {
        return (_stakingPool, _stakingPercent);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256 amount) internal virtual override {
        require(!hasRole(NO_TRANSFER, from));

        if (from != address(0)) {
            uint256 standardAmount = _getStandardAmount(amount);
            uint256 balance = balanceOf(from);
            require(standardAmount > balance || standardAmount <= balance - stakedBalanceOf(from), "Transfer amount exceeds unstaked balance");
        }

        super._beforeTokenTransfer(operator, from, to, amount);
    }

    function withdrawStake(uint256 index, uint256 amount) public {
        (uint256 netReward, uint256 grossReward) = withdraw(index, amount);
        _transferFromReflected(_stakingFund, _msgSender(), _getReflectedAmount(netReward));

        // Proportionately match the net reward with an additional reward from the staking pool
        uint256 rewardFromPool = _rewardFromPool(netReward);
        if (rewardFromPool > 0) {
            _transferFromReflected(_stakingPool, _msgSender(), _getReflectedAmount(rewardFromPool));
        }

        // Burn the unused part of the gross reward
        _burn(_stakingFund, grossReward - netReward, "", "");

        uint256 rewardTotal = netReward + rewardFromPool;
        emit Withdrawn(_msgSender(), index, amount, rewardTotal);
    }

    function stakingSummary(address account) public view virtual override returns(Stake[] memory) {
        Stake[] memory stakes = super.stakingSummary(account);

        for (uint256 i = 0; i < stakes.length; i++) {
            stakes[i].claimable += _rewardFromPool(stakes[i].claimable);
        }

        return stakes;
    }

    function _rewardFromPool(uint256 rewardFromFund) private view returns(uint256) {
        return _stakingPool == address(0) ? 0 : balanceOf(_stakingPool) * rewardFromFund / totalSupply();
    }

    event StakingChanged(address stakingPool, uint256 percent);
}
