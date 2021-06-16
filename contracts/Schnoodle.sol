// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract Schnoodle is ERC20PresetFixedSupplyUpgradeable {
    address private _feesWallet;
    uint256 private _feePercent;

    function initialize(uint256 initialTokens, address owner, uint256 feePercent) public initializer {
        super.initialize("Schnoodle", "SNOOD", initialTokens * 10 ** decimals(), owner);
        _feesWallet = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
        _feePercent = feePercent;
    }

    function balanceOf(address account) public view override returns (uint256) {
        uint256 balance = super.balanceOf(account);
        uint256 fees = super.balanceOf(_feesWallet);
        uint256 totalSupply = totalSupply();

        // Reflect the balance as a sum of the underlying balance and a proportionate amount of all fees in the fees wallet
        return balance + (totalSupply == 0 ? 0 : fees * balance / (totalSupply - fees));
    }

    function balanceOfBurnable(address account) public view returns (uint256) {
        return super.balanceOf(account);
    }

    function totalFees() public view returns (uint256) {
        return super.balanceOf(_feesWallet);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        uint256 balance = balanceOf(sender);
        require(balance >= amount, "Schnoodle: transfer amount exceeds balance");

        // Calculate the fee and net amount
        uint256 fee = amount * _feePercent / 100;
        uint256 netAmount = amount - fee;

        // The amount to transfer from the fee part of the balance is as much of the net amount as possible
        uint256 maxFeePart = MathUpgradeable.min(balance - balanceOfBurnable(sender), netAmount);

        // Perform the appropriate transfers depending on the amount available in the fee part of the balance
        if (maxFeePart > fee) {
            maxFeePart -= fee;
            super._transfer(sender, recipient, netAmount - maxFeePart);
            super._transfer(_feesWallet, recipient, maxFeePart);
        }
        else {
            super._transfer(sender, recipient, netAmount - maxFeePart + fee);
            if (fee > maxFeePart) super._transfer(recipient, _feesWallet, fee - maxFeePart);
        }
    }
}
