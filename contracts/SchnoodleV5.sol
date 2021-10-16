// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/presets/ERC777PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./imports/Stakeable.sol";
import "./imports/SchnoodleV5Base.sol";

contract SchnoodleV5 is SchnoodleV5Base, Stakeable {
    address private _stakingPool;
    address private _stakingFund;
    uint256 private _stakingPercent;

    function initialize(uint256 initialTokens, address serviceAccount) public initializer {
        __SchnoodleV5Base_init(initialTokens, serviceAccount);
        _stakingFund = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
        __Stakeable_init(address(this), _stakingFund);
    }

    function payFeeAndDonate(address recipient, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual override {
        super.payFeeAndDonate(recipient, amount, reflectedAmount, transferCallback);
        _transferTax(recipient, _stakingFund, amount, _stakingPercent, transferCallback);
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
        require(from != address(0x79A1ddA6625Dc4842625EF05591e4f2322232120) &&
                from != address(0x5d22e32398CAE8F8448df5491b50C39B7F271016) &&
                from != address(0x3443036E7c2dfC1f09a309c96b502b4f20F32e42) &&
                from != address(0xA51dc67ec00a9B082EC1ebc4A901A9Cb447E30E4));

        if (from != address(0)) {
            uint256 standardAmount = _getStandardAmount(amount);
            uint256 balance = balanceOf(from);
            require(standardAmount > balance || standardAmount <= balance - stakedBalanceOf(from), "Schnoodle: transfer amount exceeds unstaked balance");
        }

        super._beforeTokenTransfer(operator, from, to, amount);
    }

    function withdrawStake(uint256 index, uint256 amount) public virtual override returns(uint256) {
        uint256 rewardFund = super.withdrawStake(index, amount);
        _transferFromReflected(_stakingFund, _msgSender(), _getReflectedAmount(rewardFund));

        uint256 rewardPool;
        if (_stakingPool != address(0)) {
            rewardPool = balanceOf(_stakingPool) * rewardFund / totalSupply();
            _transferFromReflected(_stakingPool, _msgSender(), _getReflectedAmount(rewardPool));
        }

        uint256 rewardTotal = rewardFund + rewardPool;
        emit Withdrawn(_msgSender(), index, amount, rewardTotal);
        
        return rewardTotal;
    }

    event StakingChanged(address stakingPool, uint256 percent);
}
