// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BridgeBase is Ownable {
    address private _tokenAddress;
    string private _symbol;
    bool private _avoidReentrancy;

    mapping(address => uint256) private _tokensSent;
    mapping(address => uint256) private _tokensReceived;
    mapping(address => uint256) private _feesPaid;

    constructor(address payable tokenAddress, string memory symbol) {
        _tokenAddress = tokenAddress;
        _symbol = symbol;
    }

    function sendTokens(uint256 amount) public {
        if (ERC20(_tokenAddress).transferFrom(msg.sender, address(this), amount)) {
            _tokensSent[msg.sender] += amount;
        }
    }

    function payFee() public payable {
        payable(address(this)).transfer(msg.value);
        _feesPaid[msg.sender] += msg.value;
    }

    function receiveTokens(address account, uint256 amount, uint256 fee) public onlyOwner {
        require(!_avoidReentrancy);
        require(_feesPaid[account] >= fee, "BridgeBase: Insufficient fee paid");

        _avoidReentrancy = true;
        _feesPaid[account] -= fee;

        if (ERC20(_tokenAddress).transfer(account, amount)) {
            _tokensReceived[account] += amount;
        }

        _avoidReentrancy = false;
    }

    function transferTokens(address recipient, uint256 amount) public onlyOwner {
        ERC20(_tokenAddress).transfer(recipient, amount);
    }

    function transfer(address payable recipient, uint256 amount) public onlyOwner {
        recipient.transfer(amount);
    }

    function tokensSent(address account) external view returns (uint256) {
        return _tokensSent[account];
    }

    function tokensReceived(address account) external view returns (uint256) {
        return _tokensReceived[account];
    }
}
