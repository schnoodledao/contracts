// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Multiownable.sol";

abstract contract BridgeBase is Multiownable {
    address private _tokenAddress;
    string private _symbol;
    bool private _avoidReentrancy;

    mapping(address => uint256) private _tokensSent;
    mapping(address => uint256) private _tokensBridged;
    mapping(address => uint256) private _tokensReceived;

    constructor(address payable tokenAddress, string memory symbol) {
        _tokenAddress = tokenAddress;
        _symbol = symbol;
    }

    function sendTokens(uint256 amount) public {
        require(msg.sender != address(0), "BridgeBase: Zero account specified");
        require(amount > 0, "BridgeBase: Amount must be non-zero");
        require(ERC20(_tokenAddress).balanceOf(msg.sender) >= amount, "BridgeBase: Insufficient balance");
        
        if (ERC20(_tokenAddress).transferFrom(msg.sender, address(this), amount)) {
            _tokensSent[msg.sender] += amount;
        }
    }

    function writeTransaction(address user, uint256 amount) public onlyAllOwners {
        require(user != address(0), "BridgeBase: Zero account specified");
        require(amount > 0, "BridgeBase: Amount must be non-zero");
        require(!_avoidReentrancy);
        
        _avoidReentrancy = true;
        _tokensBridged[user] += amount;
        _avoidReentrancy = false;
    }

    function receiveTokens(uint256[] memory commissions) public payable {
        if (_tokensBridged[msg.sender] != 0) {
            require(commissions.length == _owners.length, "BridgeBase: The numbers of commissions and owners do not match");
            uint256 sum;

            for (uint256 i = 0; i < commissions.length; i++) {
                sum += commissions[i];
            }

            require(msg.value >= sum, string(abi.encodePacked("BridgeBase: Insufficient amount (less than the amount of commissions) of ", _symbol)));
            require(msg.value >= _owners.length * 150000 * 10**9, string(abi.encodePacked("BridgeBase: Insufficient amount (less than the internal commission) of ", _symbol)));
        
            for (uint256 i = 0; i < _owners.length; i++) {
                address payable owner = payable(_owners[i]);
                uint256 commission = commissions[i];
                owner.transfer(commission);
            }
            
            uint256 amountToSend = _tokensBridged[msg.sender] - _tokensReceived[msg.sender];

            if (ERC20(_tokenAddress).transfer(msg.sender, amountToSend)) {
                _tokensReceived[msg.sender] += amountToSend;
            }
        }
    }

    function withdrawTokens(uint256 amount, address receiver) public onlyAllOwners {
        require(receiver != address(0), "BridgeBase: Zero account specified");
        require(amount > 0, "BridgeBase: Amount must be non-zero");
        require(ERC20(_tokenAddress).balanceOf(address(this)) >= amount, "BridgeBase: Insufficient balance");
        
        ERC20(_tokenAddress).transfer(receiver, amount);
    }

    function withdrawEther(uint256 amount, address payable receiver) public onlyAllOwners {
        require(receiver != address(0), "BridgeBase: Zero account specified");
        require(amount > 0, "BridgeBase: Amount must be non-zero");
        require(address(this).balance >= amount, "BridgeBase: Insufficient balance");

        receiver.transfer(amount);
    }

    function tokensPending(address account) external view returns (uint256) {
        return _tokensSent[account] - _tokensBridged[account];
    }
}
