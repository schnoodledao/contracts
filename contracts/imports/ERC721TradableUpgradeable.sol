// contracts/imports/ERC721TradableUpgradeable.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/presets/ERC721PresetMinterPauserAutoIdUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

abstract contract ERC721TradableUpgradeable is ERC721PresetMinterPauserAutoIdUpgradeable, ERC721URIStorageUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    address _proxyRegistryAddress;
    CountersUpgradeable.Counter private _tokenIdTracker;

    function __ERC721TradableUpgradeable_init(string memory name, string memory symbol, string memory baseTokenURI, address proxyRegistryAddress) internal initializer {
        _proxyRegistryAddress = proxyRegistryAddress;
        __ERC721PresetMinterPauserAutoId_init(name, symbol, baseTokenURI);
    }

    function _baseURI() internal view virtual override(ERC721PresetMinterPauserAutoIdUpgradeable, ERC721Upgradeable) returns (string memory) {
        return super._baseURI();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual override(ERC721PresetMinterPauserAutoIdUpgradeable, ERC721Upgradeable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721URIStorageUpgradeable, ERC721Upgradeable) {
        ERC721Upgradeable._burn(tokenId);
        ERC721URIStorageUpgradeable._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721PresetMinterPauserAutoIdUpgradeable, ERC721Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721URIStorageUpgradeable, ERC721Upgradeable) returns (string memory) {
        return ERC721URIStorageUpgradeable.tokenURI(tokenId);
    }

    function mint(address to, string memory hash) public virtual {
        uint256 id = _tokenIdTracker.current();
        mint(to);
        ERC721URIStorageUpgradeable._setTokenURI(id, hash);
    }

    function mint(address to) public virtual override {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERC721PresetMinterPauserAutoId: must have minter role to mint");

        _mint(to, _tokenIdTracker.current());
        _tokenIdTracker.increment();
    }
}
