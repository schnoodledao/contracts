// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./imports/BridgeBase.sol";

contract BridgeBsc is BridgeBase {
    constructor(address payable tokenAddress) BridgeBase(tokenAddress, "BNB") {
    }
}
