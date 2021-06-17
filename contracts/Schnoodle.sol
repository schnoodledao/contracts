// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract SchnoodleV1 is ERC20PresetFixedSupplyUpgradeable {
    uint256 private _feePercent;
    address private _rewardsWallet;
    mapping (address => uint256) private _rewardsSpent;

    function initialize(uint256 initialTokens, address owner, uint256 feePercent) public initializer {
        super.initialize("Schnoodle", "SNOOD", initialTokens * 10 ** decimals(), owner);
        _rewardsWallet = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
        _feePercent = feePercent;
    }

    function balanceOf(address account) public view override returns (uint256) {
        uint256 balance = super.balanceOf(account);
        uint256 fees = super.balanceOf(_rewardsWallet);
        uint256 totalSupply = totalSupply();

        // Calculate the rewards as a proportionate amount of all fees in the rewards wallet
        uint256 rewards = fees * balance / (totalSupply - fees);
        uint256 rewardsSpent = _rewardsSpent[account];

        // Reflect the balance as a sum of the underlying balance and rewards less the rewards spent already
        return balance + (rewards > rewardsSpent ? rewards - rewardsSpent : 0);
    }

    function balanceOfBurnable(address account) public view returns (uint256) {
        return super.balanceOf(account);
    }

    function totalFees() public view returns (uint256) {
        return super.balanceOf(_rewardsWallet);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        uint256 balance = balanceOf(sender);
        require(balance >= amount, "Schnoodle: transfer amount exceeds balance");

        // Calculate the fee and net amount
        uint256 fee = amount * _feePercent / 100;
        uint256 netAmount = amount - fee;

        // The amount to transfer from the rewards part of the balance is as much of the net amount as possible
        uint256 maxRewardsPart = MathUpgradeable.min(balance - balanceOfBurnable(sender), netAmount);

        // Track the overall amount of rewards spent by the sender so they're deducted when calculating the rewards that make up part of their total balance
        _rewardsSpent[sender] += maxRewardsPart;

        // Perform the appropriate transfers depending on the amount available in the rewards part of the balance
        if (maxRewardsPart > fee) {
            maxRewardsPart -= fee;
            super._transfer(sender, recipient, netAmount - maxRewardsPart);
            super._transfer(_rewardsWallet, recipient, maxRewardsPart);
        }
        else {
            super._transfer(sender, recipient, netAmount - maxRewardsPart + fee);
            if (fee > maxRewardsPart) super._transfer(recipient, _rewardsWallet, fee - maxRewardsPart);
        }
    }
}
