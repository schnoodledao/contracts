// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetFixedSupplyUpgradeable.sol";

contract SchnoodleV1 is ERC20PresetFixedSupplyUpgradeable {
    uint256 private constant MAX = ~uint256(0);
    uint256 private _totalSupply;
    uint256 private _feePercent;
    uint256 private _eleemosynaryPercent;
    address private _eleemosynary;

    function initialize(uint256 initialTokens, address owner, uint256 feePercent, uint256 eleemosynaryPercent, address eleemosynary) public initializer {
        _totalSupply = initialTokens * 10 ** decimals();
        super.initialize("Schnoodle", "SNOOD", MAX - (MAX % totalSupply()), owner);
        _feePercent = feePercent;
        _eleemosynaryPercent = eleemosynaryPercent;
        _eleemosynary = eleemosynary;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        uint256 reflectedBalance = super.balanceOf(account);
        require(reflectedBalance <= super.totalSupply(), "Schnoodle: Reflected balance must be less than total reflections");
        return reflectedBalance / _getRate();
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        uint256 rate = _getRate();
        uint256 eleemosynaryAmount = _eleemosynaryPercent * amount / 100;

        _transfer(sender, _eleemosynary, eleemosynaryAmount, rate);
        _transfer(sender, recipient, amount - eleemosynaryAmount, rate);
    }

    function _transfer(address sender, address recipient, uint256 amount, uint256 rate) private {
        super._transfer(sender, recipient, amount * rate);
        _burn(recipient, amount * _feePercent / 100 * rate);
    }

    function _getRate() private view returns(uint256) {
        return super.totalSupply() / totalSupply();
    }

    function burn(uint256 amount) public virtual override {
        super.burn(amount * _getRate());
        _totalSupply -= amount;
    }

    function burnFrom(address account, uint256 amount) public virtual override {
        super.burnFrom(account, amount * _getRate());
        _totalSupply -= amount;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return super.allowance(owner, spender) / _getRate();
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        return super.approve(spender, amount * _getRate());
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        return super.transferFrom(sender, recipient, amount * _getRate());
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual override returns (bool) {
        return super.increaseAllowance(spender, addedValue * _getRate());
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual override returns (bool) {
        return super.decreaseAllowance(spender, subtractedValue * _getRate());
    }
}
