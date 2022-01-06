// contracts/MoontronV1.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./imports/ERC721TradableUpgradeable.sol";

contract OwnableDelegateProxy {}

/// Used to delegate ownership of a contract to another address, to save on unneeded transactions to approve contract use for users
contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}

contract MoontronV1 is ERC721TradableUpgradeable {
    function initialize(address proxyRegistryAddress) public initializer {
        __ERC721TradableUpgradeable_init("Moontron", "MTN", "ipfs://", proxyRegistryAddress);
    }

    /// Override to whitelist user's OpenSea proxy accounts to enable gasless listings
    function isApprovedForAll(address owner, address operator) override public view returns (bool)
    {
        // Whitelist OpenSea proxy contract for easy trading
        ProxyRegistry proxyRegistry = ProxyRegistry(_proxyRegistryAddress);
        if (address(proxyRegistry.proxies(owner)) == operator) {
            return true;
        }

        return super.isApprovedForAll(owner, operator);
    }
}
