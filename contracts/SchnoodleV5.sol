// contracts/SchnoodleV5.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./imports/SchnoodleV5Base.sol";

/// @author Jason Payne (https://twitter.com/Neo42)
contract SchnoodleV5 is SchnoodleV5Base, AccessControlUpgradeable {
    uint256 private _stakingPercent;
    address private _stakingFund;
    mapping(address => uint256) private _stakedBalances;

    bytes32 public constant FEE_EXEMPT = keccak256("FEE_EXEMPT");
    bytes32 public constant NO_TRANSFER = keccak256("NO_TRANSFER");

    function initialize(uint256 initialTokens, address serviceAccount) public initializer {
        __SchnoodleV5Base_init(initialTokens, serviceAccount);
        _stakingFund = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
    }

    function payFeeAndDonate(address sender, address recipient, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual override {
        if (!hasRole(FEE_EXEMPT, sender)) {
            super.payFeeAndDonate(sender, recipient, amount, reflectedAmount, transferCallback);
            _transferTax(recipient, _stakingFund, amount, _stakingPercent, transferCallback);
        }
    }

    function stakingFund() external view returns (address) {
        return _stakingFund;
    }

    function changeStakingPercent(uint256 percent) external onlyOwner {
        _stakingPercent = percent;
        emit StakingPercentChanged(percent);
    }

    function stakingPercent() external view returns (uint256) {
        return _stakingPercent;
    }

    function adjustStakedBalance(int256 amount) external {
        _stakedBalances[_msgSender()] = uint256(int256(_stakedBalances[_msgSender()]) + amount);
    }

    function stakedBalanceOf(address account) external view returns(uint256) {
        return _stakedBalances[account];
    }

    function stakingReward(uint256 netReward, uint256 grossReward) external {
        _transferFromReflected(_stakingFund, _msgSender(), _getReflectedAmount(netReward));

        // Burn the unused part of the gross reward
        _burn(_stakingFund, grossReward - netReward, "", "");
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256 amount) internal virtual override {
        require(!hasRole(NO_TRANSFER, from));

        if (from != address(0)) {
            uint256 standardAmount = _getStandardAmount(amount);
            uint256 balance = balanceOf(from);
            require(standardAmount > balance || standardAmount <= balance - _stakedBalances[from], "Transfer amount exceeds unstaked balance");
        }

        super._beforeTokenTransfer(operator, from, to, amount);
    }

    event StakingPercentChanged(uint256 percent);
}
