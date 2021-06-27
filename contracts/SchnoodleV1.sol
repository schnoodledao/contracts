// contracts/Schnoodle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract SchnoodleV1 is ERC20PresetFixedSupplyUpgradeable, OwnableUpgradeable {
    uint256 private constant MAX = ~uint256(0);
    uint256 private _totalSupply;
    uint256 private _feePercent;
    address private _eleemosynary;
    uint256 private _donationPercent;

    function initialize(uint256 initialTokens, address owner) public initializer {
        __Ownable_init();
        _totalSupply = initialTokens * 10 ** decimals();
        super.initialize("Schnoodle", "SNOOD", MAX - (MAX % totalSupply()), owner);
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
        uint256 eleemosynaryAmount;

        // The eleemosynary fund is optional
        if (_eleemosynary != address(0)) {
            eleemosynaryAmount = _donationPercent * amount / 100;
            _transfer(sender, _eleemosynary, eleemosynaryAmount, _donationPercent);
        }

        _transfer(sender, recipient, amount - eleemosynaryAmount, _feePercent);
    }

    function _transfer(address sender, address recipient, uint256 amount, uint256 percent) private {
        uint256 rate = _getRate();
        super._transfer(sender, recipient, amount * rate);
        _burn(recipient, amount * percent / 100 * rate);
    }

    function _getRate() private view returns(uint256) {
        return super.totalSupply() / totalSupply();
    }

    function changeFeePercent(uint256 percent) public onlyOwner {
        _feePercent = percent;
        emit FeePercentChanged(percent);
    }

    function changeEleemosynary(address account, uint256 percent) public onlyOwner {
        _eleemosynary = account;
        _donationPercent = percent;
        emit EleemosynaryChanged(account, percent);
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

    event FeePercentChanged(uint256 percent);

    event EleemosynaryChanged(address indexed account, uint256 percent);
}
