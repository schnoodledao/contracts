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

    function initialize(uint256 initialTokens, address serviceAccount) public initializer {
        __Ownable_init();
        _totalSupply = initialTokens * 10 ** decimals();
        super.initialize("Schnoodle", "SNOOD", MAX - (MAX % totalSupply()), serviceAccount);
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
        _transferReflected(sender, recipient, amount);

        // The eleemosynary fund is optional
        if (_eleemosynary != address(0)) {
            _transferReflected(recipient, _eleemosynary, _donationPercent * amount / 100);
        }
    }

    function _transferReflected(address sender, address recipient, uint256 amount) private {
        uint256 rate = _getRate();
        super._transfer(sender, recipient, amount * rate);
        super._burn(recipient, amount * _feePercent / 100 * rate);
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

    function _burn(address account, uint256 amount) internal virtual override {
        super._burn(account, amount * _getRate());
        _totalSupply -= amount;
    }

    event FeePercentChanged(uint256 percent);

    event EleemosynaryChanged(address indexed account, uint256 percent);
}
