// contracts/imports/DelegateCallee.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract DelegateCallee {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable state-variable-assignment
    address private immutable self = address(this);

    modifier onlyDelegateCall() {
        require(address(this) != self);
        _;
    }
}
