// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./imports/BridgeBase.sol";

contract BridgeEthereum is BridgeBase {
    constructor(address payable tokenAddress) BridgeBase(tokenAddress, "ETH") {
    }
}
