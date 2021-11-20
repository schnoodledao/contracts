// contracts/imports/SchnoodleV7Base.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC777/presets/ERC777PresetFixedSupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

abstract contract SchnoodleV7Base is ERC777PresetFixedSupplyUpgradeable, OwnableUpgradeable {
    uint256 private constant MAX = ~uint256(0);
    uint256 private _totalSupply;
    uint256 private _feeRate;
    address private _eleemosynary;
    uint256 private _donationRate;
    uint256 private _sellThreshold;
    TokenMeter private _sellQuota;
    mapping(address => ReflectTracker) private _reflectTrackers;

    struct TokenMeter {
        uint256 blockMetric;
        int256 amount;
    }

    struct ReflectTracker {
        TokenMeter checkpointBalance;
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
        processSwap(_msgSender(), recipient, amount, reflectedAmount, _transferFromReflected);
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
        processSwap(sender, recipient, amount, reflectedAmount, _transferFromReflected);
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
        processSwap(from, to, amount, reflectedAmount, _sendReflected);
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
        return amount * _getReflectRate();
    }

    function _getStandardAmount(uint256 reflectedAmount) internal view returns(uint256) {
        // Condition prevents a divide-by-zero error when the total supply is zero
        return reflectedAmount == 0 ? 0 : reflectedAmount / _getReflectRate();
    }

    function _getReflectRate() private view returns(uint256) {
        uint256 reflectedTotalSupply = super.totalSupply();
        return reflectedTotalSupply == 0 ? 0 : super.totalSupply() / totalSupply();
    }

    // Taxation functions

    function processSwap(address from, address to, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual {
        // Maintain a sell quota as the net of all daily buys and sells, plus a predefined threshold
        if (_sellThreshold > 0) {
            uint256 blockTimestamp = block.timestamp;

            if (_sellQuota.blockMetric == 0 || _sellQuota.blockMetric < blockTimestamp - 1 days) {
                _sellQuota.blockMetric = blockTimestamp;
                _sellQuota.amount = int256(_sellThreshold);
                emit SellQuotaChanged(_sellQuota.blockMetric, _sellQuota.amount);
            }

            _sellQuota.amount += (isLiquidityToken(from) ? int256(1) : -1) * int256(amount);
            emit SellQuotaChanged(_sellQuota.blockMetric, _sellQuota.amount);
        }

        // Proceed to pay fee and tax if only a sell at this point
        if (!(isLiquidityToken(to))) return;

        _payFee(to, amount, reflectedAmount);
        _transferTax(to, _eleemosynary, amount, _donationRate, transferCallback);
    }

    function isLiquidityToken(address) internal view virtual returns(bool);

    function _transferTax(address from, address to, uint256 amount, uint256 rate, function(address, address, uint256) internal transferCallback) internal {
        // Ignore tax if not enabled
        if (to != address(0)) {
            uint256 taxAmount = amount * rate / 1000;
            uint256 reflectedDonationAmount = _getReflectedAmount(taxAmount);
            transferCallback(from, to, reflectedDonationAmount);
            emit Transfer(from, to, taxAmount);
        }
    }

    function _payFee(address to, uint256 amount, uint256 reflectedAmount) private {
        uint256 operativeFeeRate = getOperativeFeeRate();
        super._burn(to, reflectedAmount / 1000 * operativeFeeRate, "", "");
        emit Transfer(to, address(0), amount * operativeFeeRate / 1000);
    }

    function changeFeeRate(uint256 rate) external onlyOwner {
        _feeRate = rate;
        emit FeeRateChanged(rate);
    }

    function feeRate() external view returns(uint256) {
        return _feeRate;
    }

    function getOperativeFeeRate() public view returns(uint256) {
        // Increase the fee linearly when the sell quota is negative (more daily sells than buys including the predefined threshold)
        if (_sellThreshold > 0 && _sellQuota.amount < 0)
        {
            return _feeRate + _feeRate * 3 * MathUpgradeable.min(uint256(-_sellQuota.amount), _sellThreshold) / _sellThreshold;
        }

        return _feeRate;
    }

    function changeEleemosynary(address account, uint256 rate) external onlyOwner {
        _eleemosynary = account;
        _donationRate = rate;
        emit EleemosynaryChanged(account, rate);
    }

    function eleemosynary() external view returns(address, uint256) {
        return (_eleemosynary, _donationRate);
    }

    function changeSellThreshold(uint256 threshold) external onlyOwner {
        _sellThreshold = threshold;
        emit SellThresholdChanged(threshold);
    }

    function sellThreshold() external view returns(uint256) {
        return _sellThreshold;
    }

    function sellQuota() external view returns(TokenMeter memory) {
        return _sellQuota;
    }

    // Reflect Tracker functions

    function reflectTrackerInfo(address account) external view returns (uint256, uint256) {
        ReflectTracker memory reflectTracker = _reflectTrackers[account];
        return (reflectTracker.checkpointBalance.blockMetric, _currentDeltaBalance(account, reflectTracker));
    }

    function _captureReflectedBalances(address account1, address account2) private {
        _captureReflectedBalance(account1);
        _captureReflectedBalance(account2);
    }

    function _captureReflectedBalance(address account) private {
        if (account == address(0)) return;
        ReflectTracker storage reflectTracker = _reflectTrackers[account];

        if (reflectTracker.checkpointBalance.blockMetric == 0) {
             _resetReflectTracker(account);
        } else {
            reflectTracker.deltaBalance = _currentDeltaBalance(account, reflectTracker);
        }
    }

    function _currentDeltaBalance(address account, ReflectTracker memory reflectTracker) private view returns(uint256) {
        return reflectTracker.deltaBalance + balanceOf(account) - uint256(reflectTracker.checkpointBalance.amount);
    }

    function _reflectTrackerCheckpoints(address account1, address account2) private {
        _reflectTrackerCheckpoint(account1);
        _reflectTrackerCheckpoint(account2);
    }

    function _reflectTrackerCheckpoint(address account) private {
        if (account == address(0)) return;
        _reflectTrackers[account].checkpointBalance.amount = int256(balanceOf(account));
    }

    function resetReflectTracker() public {
        _resetReflectTracker(_msgSender());
    }

    function _resetReflectTrackers(address account1, address account2) private {
        _resetReflectTracker(account1);
        _resetReflectTracker(account2);
    }

    function _resetReflectTracker(address account) private {
        _reflectTrackers[account] = ReflectTracker(TokenMeter(block.number, int256(balanceOf(account))), 0);
    }

    event FeeRateChanged(uint256 rate);

    event EleemosynaryChanged(address indexed account, uint256 rate);

    event SellThresholdChanged(uint256 threshold);

    event SellQuotaChanged(uint256 blockTimestamp, int256 amount);
}
