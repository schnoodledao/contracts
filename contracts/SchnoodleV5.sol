// contracts/SchnoodleV5.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./imports/SchnoodleV5Base.sol";

/// @author Jason Payne (https://twitter.com/Neo42)
contract SchnoodleV5 is SchnoodleV5Base, AccessControlUpgradeable {
    uint256 private _version;
    address private _schnoodleStaking;
    address private _stakingFund;
    uint256 private _stakingPercent;
    mapping(address => TripMeter) private _tripMeters;

    bytes32 public constant FEE_EXEMPT = keccak256("FEE_EXEMPT");
    bytes32 public constant NO_TRANSFER = keccak256("NO_TRANSFER");
    bytes32 public constant STAKING_CONTRACT = keccak256("STAKING_CONTRACT");

    struct TripMeter {
        uint256 blockNumber;
        uint256 netBalance;
    }

    function upgrade(address schnoodleStaking) external onlyOwner {
        require(_version < 5, "Schnoodle: already upgraded");
        _version = 5;

        _setupRole(DEFAULT_ADMIN_ROLE, owner());
        grantRole(STAKING_CONTRACT, schnoodleStaking);
        _schnoodleStaking = schnoodleStaking;
        _stakingFund = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, blockhash(block.number - 1))))));
    }

    function payFeeAndDonate(address sender, address recipient, uint256 amount, uint256 reflectedAmount, function(address, address, uint256) internal transferCallback) internal virtual override {
        if (!hasRole(FEE_EXEMPT, sender)) {
            super.payFeeAndDonate(sender, recipient, amount, reflectedAmount, transferCallback);
            _transferTax(recipient, _stakingFund, amount, _stakingPercent, transferCallback);
        }
    }

    function tripMeter(address account) external view returns (TripMeter memory) {
        return _tripMeters[account];
    }

    function resetTripMeter() public {
        _resetTripMeter(_msgSender());
    }

    function _resetTripMeter(address account) public {
        _tripMeters[account] = TripMeter(block.number, balanceOf(account));
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

    function stakingReward(address account, uint256 netReward, uint256 grossReward) external {
        require(hasRole(STAKING_CONTRACT, _msgSender()));
        _transferFromReflected(_stakingFund, account, _getReflectedAmount(netReward));

        // Burn the unused part of the gross reward
        _burn(_stakingFund, grossReward - netReward, "", "");
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256 amount) internal virtual override {
        require(!hasRole(NO_TRANSFER, from));

        // This would only ever be false when the initial supply is first minted
        if (ERC777Upgradeable.totalSupply() > 0)
        {
            uint256 standardAmount = _getStandardAmount(amount);

            if (from != address(0)) {
                uint256 balance = balanceOf(from);
                require(standardAmount > balance || standardAmount <= balance - lockedBalanceOf(from), "Schnoodle: transfer amount exceeds unstaked balance");

                if (_tripMeters[from].blockNumber == 0) _resetTripMeter(from);
                _tripMeters[from].netBalance -= standardAmount;
            }

            if (to != address(0)) {
                if (_tripMeters[to].blockNumber == 0) _resetTripMeter(to);
                _tripMeters[to].netBalance += standardAmount;
            }
        }

        super._beforeTokenTransfer(operator, from, to, amount);
    }

    // Calls to the SchnoodleStaking proxy contract

    function stakedBalanceOf(address account) private returns(uint256) {
        (bool success, bytes memory result) = _schnoodleStaking.call(abi.encodeWithSignature("stakedBalanceOf(address)", account));
        assert(success);
        return abi.decode(result, (uint256));
    }

    event StakingPercentChanged(uint256 percent);
}
