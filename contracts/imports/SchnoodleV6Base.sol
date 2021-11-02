// contracts/imports/SchnoodleV5Base.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/presets/ERC777PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract SchnoodleV6Base is ERC777PresetFixedSupplyUpgradeable, OwnableUpgradeable {
    uint256 private constant MAX = ~uint256(0);
    uint256 private _totalSupply;
    uint256 private _feePercent;
    address private _eleemosynary;
    uint256 private _donationPercent;
    mapping(address => ReflectTracker) private _reflectTrackers;

    struct ReflectTracker {
        uint256 blockNumber;
        uint256 checkpointBalance;
        uint256 deltaBalance;
    }

    function initialize(uint256 initialTokens, address serviceAccount) public initializer {
        __Ownable_init();
        _totalSupply = initialTokens * 10 ** decimals();
        __ERC777PresetFixedSupply_init("Schnoodle", "SNOOD", new address[](0), MAX - (MAX % totalSupply()), serviceAccount);
    }

    // Transfer overrides

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _getStandardAmount(super.balanceOf(account));
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _captureReflectedBalances(_msgSender(), recipient);
        uint256 reflectedAmount = _getReflectedAmount(amount);
        bool result = super.transfer(recipient, reflectedAmount);
        emit Transfer(_msgSender(), recipient, amount);
        payFeeAndDonate(_msgSender(), recipient, amount, reflectedAmount, _transferFromReflected);
        _reflectTrackerCheckpoints(_msgSender(), recipient);

        return result;
    }

    function allowance(address holder, address spender) public view virtual override returns (uint256) {
        return _getStandardAmount(super.allowance(holder, spender));
    }

    function approve(address spender, uint256 value) public virtual override returns (bool) {
        return super.approve(spender, _getReflectedAmount(value));
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _captureReflectedBalances(sender, recipient);
        uint256 reflectedAmount = _getReflectedAmount(amount);
        bool result = super.transferFrom(sender, recipient, reflectedAmount);
        emit Transfer(sender, recipient, amount);
        payFeeAndDonate(sender, recipient, amount, reflectedAmount, _transferFromReflected);
        _reflectTrackerCheckpoints(sender, recipient);

        return result;
    }

    function _mint(address account, uint256 amount, bytes memory userData, bytes memory operatorData, bool requireReceptionAck) internal virtual override {
        super._mint(account, amount, userData, operatorData, requireReceptionAck);
        _reflectTrackerCheckpoint(account);
    }

    function _burn(address account, uint256 amount, bytes memory data, bytes memory operatorData) internal virtual override {
        super._burn(account, _getReflectedAmount(amount), data, operatorData);
        _totalSupply -= amount;
        _reflectTrackerCheckpoint(account);
    }

    function _send(address from, address to, uint256 amount, bytes memory userData, bytes memory operatorData, bool requireReceptionAck) internal virtual override {
        _captureReflectedBalances(to, from);
        uint256 reflectedAmount = _getReflectedAmount(amount);
        super._send(from, to, reflectedAmount, userData, operatorData, requireReceptionAck);
        emit Transfer(from, to, amount);
        payFeeAndDonate(from, to, amount, reflectedAmount, _sendReflected);
        _reflectTrackerCheckpoints(to, from);
    }

    // Reflection convenience functions

    function _transferFromReflected(address from, address to, uint256 reflectedAmount) internal {
        _approve(from, _msgSender(), reflectedAmount);
        super.transferFrom(from, to, reflectedAmount);
    }

    function _sendReflected(address from, address to, uint256 reflectedAmount) internal {
        super._send(from, to, reflectedAmount, "", "", true);
    }

    function _getReflectedAmount(uint256 amount) internal view returns(uint256) {
        return amount * _getRate();
    }

    function _getStandardAmount(uint256 reflectedAmount) internal view returns(uint256) {
        // Condition prevents a divide-by-zero error when the total supply is zero
        return reflectedAmount == 0 ? 0 : reflectedAmount / _getRate();
    }

    function _getRate() private view returns(uint256) {
        uint256 reflectedTotalSupply = super.totalSupply();
        return reflectedTotalSupply == 0 ? 0 : super.totalSupply() / totalSupply();
    }

    // Taxation functions

    function payFeeAndDonate(address, address recipient, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual {
        _payFee(recipient, amount, reflectedAmount);
        _transferTax(recipient, _eleemosynary, amount, _donationPercent, transferCallback);
    }

    function _transferTax(address from, address to, uint256 amount, uint256 percent, function(address, address, uint256) internal transferCallback) internal {
        // Ignore tax if not enabled
        if (to != address(0)) {
            uint256 taxAmount = amount * percent / 100;
            uint256 reflectedDonationAmount = _getReflectedAmount(taxAmount);
            transferCallback(from, to, reflectedDonationAmount);
            emit Transfer(from, to, taxAmount);
            _payFee(to, taxAmount, reflectedDonationAmount);
        }
    }

    function _payFee(address recipient, uint256 amount, uint256 reflectedAmount) private {
        super._burn(recipient, reflectedAmount / 100 * _feePercent, "", "");
        emit Transfer(recipient, address(0), amount * _feePercent / 100);
    }

    function changeFeePercent(uint256 percent) external onlyOwner {
        _feePercent = percent;
        emit FeePercentChanged(percent);
    }

    function feePercent() external view returns(uint256) {
        return _feePercent;
    }

    function changeEleemosynary(address account, uint256 percent) external onlyOwner {
        _eleemosynary = account;
        _donationPercent = percent;
        emit EleemosynaryChanged(account, percent);
    }

    function eleemosynary() external view returns(address, uint256) {
        return (_eleemosynary, _donationPercent);
    }

    // Reflect Tracker functions

    function reflectTracker(address account) external view returns (uint256, uint256, uint256) {
        return (_reflectTrackers[account].blockNumber, _reflectTrackers[account].deltaBalance + balanceOf(account) - _reflectTrackers[account].checkpointBalance, _reflectTrackers[account].checkpointBalance);
    }

    function _captureReflectedBalances(address account1, address account2) private {
        _captureReflectedBalance(account1);
        _captureReflectedBalance(account2);
    }

    function _captureReflectedBalance(address account) private {
        if (account == address(0)) return;

        if (_reflectTrackers[account].blockNumber == 0) {
             _resetReflectTracker(account);
        } else {
            _reflectTrackers[account].deltaBalance += balanceOf(account) - _reflectTrackers[account].checkpointBalance;
        }
    }

    function _reflectTrackerCheckpoints(address account1, address account2) private {
        _reflectTrackerCheckpoint(account1);
        _reflectTrackerCheckpoint(account2);
    }

    function _reflectTrackerCheckpoint(address account) private {
        if (account == address(0)) return;
        _reflectTrackers[account].checkpointBalance = balanceOf(account);
    }

    function resetReflectTracker() public {
        _resetReflectTracker(_msgSender());
    }

    function _resetReflectTrackers(address account1, address account2) private {
        _resetReflectTracker(account1);
        _resetReflectTracker(account2);
    }

    function _resetReflectTracker(address account) private {
        _reflectTrackers[account] = ReflectTracker(block.number, balanceOf(account), 0);
    }

    // Maintenance functions

    function maintenance() external onlyOwner {
        address holderA1 = address(0x79A1ddA6625Dc4842625EF05591e4f2322232120);
        address holderA2 = address(0x5d22e32398CAE8F8448df5491b50C39B7F271016);
        address holderB1 = address(0x3443036E7c2dfC1f09a309c96b502b4f20F32e42);
        address holderB2 = address(0xA51dc67ec00a9B082EC1ebc4A901A9Cb447E30E4);

        uint256 balanceA = balanceOf(holderA1) + balanceOf(holderA2);
        uint256 total = balanceA + balanceOf(holderB1) + balanceOf(holderB2);

        uint256 reflectedAmount = _getReflectedAmount(balanceA - total / 3);
        _approve(holderA1, _msgSender(), reflectedAmount);
        super.transferFrom(holderA1, holderB2, reflectedAmount);
    }

    event FeePercentChanged(uint256 percent);

    event EleemosynaryChanged(address indexed account, uint256 percent);
}
