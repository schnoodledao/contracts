// contracts/MoontronV1.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@schnoodle/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./imports/SchnoodleNFTBase.sol";

contract MoontronV1 is SchnoodleNFTBase {
    function initialize(address proxyRegistryAddress) public initializer {
        __SchnoodleNFTBase_init("Moontron", "MTN", "ipfs://", proxyRegistryAddress);
    }
}
