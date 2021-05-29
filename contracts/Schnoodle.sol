// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract Schnoodle is ERC20PresetMinterPauserUpgradeable, ERC20CappedUpgradeable {
    address private _feesWallet;
    uint256 private _feeRate;

    function initialize() initializer public {
        super.initialize("Schnoodle", "SNOOD");
        __ERC20Capped_init(1000000000 * 10 ** decimals());
        _feesWallet = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
        _feeRate = 3;
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
        uint256 fee = amount * _feeRate / 100;
        uint256 netAmount = amount - fee;

        uint256 balanceFee = balance - super.balanceOf(sender);

        // Take net amount from the fee part of balance first
        uint256 netAmountFromBalanceFee = MathUpgradeable.min(balanceFee, netAmount);
        if (netAmountFromBalanceFee > 0) super._transfer(_feesWallet, recipient, netAmountFromBalanceFee);

        // Reduce amount available to use from fee part of balance, and reduce net amount left to transfer
        balanceFee -= netAmountFromBalanceFee;
        netAmount -= netAmountFromBalanceFee;

        // Consider any remaining fee part of balance as being towards the fee (no actual transfer required, of course), and reduce fee left to transfer accordingly
        fee -= MathUpgradeable.min(balanceFee, fee);

        // Pay any remaining net amount and fee from the sender's wallet
        if (netAmount > 0) super._transfer(sender, recipient, netAmount);
        if (fee > 0) super._transfer(sender, _feesWallet, fee);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override (ERC20PresetMinterPauserUpgradeable, ERC20Upgradeable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual override (ERC20Upgradeable, ERC20CappedUpgradeable) {
        super._mint(account, amount);
    }
}
