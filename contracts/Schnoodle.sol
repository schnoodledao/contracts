// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "abdk-libraries-solidity/ABDKMathQuad.sol";

contract Schnoodle is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Schnoodle", "SNOOD") {
        _feesWallet = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
    }

    address private _feesWallet;
    bytes16 private _totalSupply;
    uint256 private _feeRate = 3;

    function balanceOf(address account) public view override returns (uint256) {
        // Reflect the balance as a sum of the underlying balance and a proportionate amount of all fees in the fees wallet
        bytes16 balance = ABDKMathQuad.fromUInt(super.balanceOf(account));
        bytes16 fees = ABDKMathQuad.fromUInt(super.balanceOf(_feesWallet));

        return ABDKMathQuad.toUInt(
            ABDKMathQuad.add(
                balance,
                ABDKMathQuad.mul(
                    ABDKMathQuad.eq(_totalSupply, bytes16(0))
                        ? bytes16(0)
                        : ABDKMathQuad.div(
                            balance,
                            ABDKMathQuad.sub(
                                _totalSupply,
                                fees
                            )
                        ),
                    fees
                )
            )
        );
    }

    function balanceOfBurnable(address account) public view returns (uint256) {
        return super.balanceOf(account);
    }

    function totalFees() public view returns (uint256) {
        return super.balanceOf(_feesWallet);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override virtual {
        uint256 balance = balanceOf(sender);
        require(balance >= amount, "Schnoodle: transfer amount exceeds balance");

        // Calculate the fee and net amount
        uint256 fee = amount * _feeRate / 100;
        uint256 netAmount = amount - fee;

        uint256 balanceFee = balance - super.balanceOf(sender);

        // Take net amount from the fee part of balance first
        uint256 netAmountFromBalanceFee = Math.min(balanceFee, netAmount);
        if (netAmountFromBalanceFee > 0) super._transfer(_feesWallet, recipient, netAmountFromBalanceFee);

        // Reduce amount available to use from fee part of balance, and reduce net amount left to transfer
        balanceFee -= netAmountFromBalanceFee;
        netAmount -= netAmountFromBalanceFee;

        // Consider any remaining fee part of balance as being towards the fee (no actual transfer required, of course), and reduce fee left to transfer accordingly
        fee -= Math.min(balanceFee, fee);

        // Pay any remaining net amount and fee from the sender's wallet
        if (netAmount > 0) super._transfer(sender, recipient, netAmount);
        if (fee > 0) super._transfer(sender, _feesWallet, fee);
    }

    function _mint(address account, uint256 amount) internal override virtual {
        super._mint(account, amount);
        _updateTotalSupply();
    }

    function _burn(address account, uint256 amount) internal override virtual {
        super._burn(account, amount);
        _updateTotalSupply();
    }

    function _updateTotalSupply() private {
        _totalSupply = ABDKMathQuad.fromUInt(totalSupply());
    }
}
