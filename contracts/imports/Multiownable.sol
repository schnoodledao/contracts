// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Multiownable {
    uint256 private _ownersGeneration;
    uint256 private _requiredConfirmations;
    address[] internal _owners;
    bytes32[] public _allOperations;
    address private _insideCallSender;
    uint256 private _insideCallCount;

    // Reverse lookup tables for _owners and _allOperations
    mapping(address => uint) private _ownersIndices; // Starts from 1
    mapping(bytes32 => uint) private _allOperationsIndices;

    // Owners voting mask per operations
    mapping(bytes32 => uint256) private _votesMaskByOperation;
    mapping(bytes32 => uint256) private _votesCountByOperation;

    constructor() {
        _owners.push(msg.sender);
        _ownersIndices[msg.sender] = 1;
        _requiredConfirmations = 1;
    }

    // ACCESSORS

    function isOwner(address account) public view returns(bool) {
        return _ownersIndices[account] > 0;
    }

    function ownersCount() public view returns(uint) {
        return _owners.length;
    }

    function allOperationsCount() public view returns(uint) {
        return _allOperations.length;
    }

    // MODIFIERS

    /// Allows to perform method by any of the owners
    modifier onlyAnyOwner {
        if (checkHowManyOwners(1)) {
            bool update = (_insideCallSender == address(0));
            if (update) {
                _insideCallSender = msg.sender;
                _insideCallCount = 1;
            }
            _;
            if (update) {
                _insideCallSender = address(0);
                _insideCallCount = 0;
            }
        }
    }

    /// Allows to perform method only after many owners call it with the same arguments
    modifier onlyManyOwners {
        if (checkHowManyOwners(_requiredConfirmations)) {
            bool update = (_insideCallSender == address(0));
            if (update) {
                _insideCallSender = msg.sender;
                _insideCallCount = _requiredConfirmations;
            }
            _;
            if (update) {
                _insideCallSender = address(0);
                _insideCallCount = 0;
            }
        }
    }

    /// Allows to perform method only after all owners call it with the same arguments
    modifier onlyAllOwners {
        if (checkHowManyOwners(_owners.length)) {
            bool update = (_insideCallSender == address(0));
            if (update) {
                _insideCallSender = msg.sender;
                _insideCallCount = _owners.length;
            }
            _;
            if (update) {
                _insideCallSender = address(0);
                _insideCallCount = 0;
            }
        }
    }

    /// Allows to perform method only after some owners call it with the same arguments
    modifier onlySomeOwners(uint howMany) {
        require(howMany > 0, "Multiownable: howMany argument is zero");
        require(howMany <= _owners.length, "Multiownable: howMany argument exceeds the number of owners");
        
        if (checkHowManyOwners(howMany)) {
            bool update = (_insideCallSender == address(0));
            if (update) {
                _insideCallSender = msg.sender;
                _insideCallCount = howMany;
            }
            _;
            if (update) {
                _insideCallSender = address(0);
                _insideCallCount = 0;
            }
        }
    }

    // INTERNAL METHODS

    /// onlyManyOwners modifier helper
    function checkHowManyOwners(uint howMany) internal returns(bool) {
        if (_insideCallSender == msg.sender) {
            require(howMany <= _insideCallCount, "Multiownable: nested owners modifier check require more owners");
            return true;
        }

        uint ownerIndex = _ownersIndices[msg.sender] - 1;
        require(ownerIndex < _owners.length, "Multiownable: msg.sender is not an owner");
        bytes32 operation = keccak256(abi.encodePacked(msg.data, _ownersGeneration));

        require((_votesMaskByOperation[operation] & (2 ** ownerIndex)) == 0, "Multiownable: owner already voted for the operation");
        _votesMaskByOperation[operation] |= (2 ** ownerIndex);
        uint operationVotesCount = _votesCountByOperation[operation] + 1;
        _votesCountByOperation[operation] = operationVotesCount;

        if (operationVotesCount == 1) {
            _allOperationsIndices[operation] = _allOperations.length;
            _allOperations.push(operation);
            emit OperationCreated(operation, howMany, _owners.length, msg.sender);
        }

        emit OperationUpvoted(operation, operationVotesCount, howMany, _owners.length, msg.sender);

        // If enough owners confirmed the same operation
        if (_votesCountByOperation[operation] == howMany) {
            deleteOperation(operation);
            emit OperationPerformed(operation, howMany, _owners.length, msg.sender);
            return true;
        }

        return false;
    }

    /// Used to delete cancelled or performed operation
    /// @param operation defines which operation to delete
    function deleteOperation(bytes32 operation) internal {
        uint index = _allOperationsIndices[operation];
        if (index < _allOperations.length - 1) { // Not last
            _allOperations[index] = _allOperations[_allOperations.length - 1];
            _allOperationsIndices[_allOperations[index]] = index;
        }

        _allOperations.push(_allOperations[_allOperations.length-1]);

        delete _votesMaskByOperation[operation];
        delete _votesCountByOperation[operation];
        delete _allOperationsIndices[operation];
    }

    // PUBLIC METHODS

    /// Allows owners to change their mind by cancelling _votesMaskByOperation operations
    /// @param operation defines which operation to delete
    function cancelPending(bytes32 operation) public onlyAnyOwner {
        uint ownerIndex = _ownersIndices[msg.sender] - 1;
        require((_votesMaskByOperation[operation] & (2 ** ownerIndex)) != 0, "Multiownable: operation not found for this user");
        _votesMaskByOperation[operation] &= ~(2 ** ownerIndex);

        uint operationVotesCount = _votesCountByOperation[operation] - 1;
        _votesCountByOperation[operation] = operationVotesCount;
        emit OperationDownvoted(operation, operationVotesCount, _owners.length, msg.sender);

        if (operationVotesCount == 0) {
            deleteOperation(operation);
            emit OperationCancelled(operation, msg.sender);
        }
    }

    /// Allows owners to change ownership
    /// @param newOwners defines array of addresses of new owners
    function transferOwnership(address[] memory newOwners) public {
        transferOwnership(newOwners, newOwners.length);
    }

    /// Allows owners to change ownership
    /// @param newOwners defines array of addresses of new owners
    /// @param requiredConfirmations defines how many owners can decide
    function transferOwnership(address[] memory newOwners, uint256 requiredConfirmations) public onlyManyOwners {
        require(newOwners.length > 0, "Multiownable: no new owners specified");
        require(newOwners.length <= 256, "Multiownable: exceeded maximum number of owners");
        require(requiredConfirmations > 0, "Multiownable: required confirmations must be greater than zero");
        require(requiredConfirmations <= newOwners.length, "Multiownable: required confirmations exceeds the number of owners");

        // Reset owners reverse lookup table
        for (uint j = 0; j < _owners.length; j++) {
            delete _ownersIndices[_owners[j]];
        }

        for (uint i = 0; i < newOwners.length; i++) {
            require(newOwners[i] != address(0), "Multiownable: owner must be a non-zero address");
            require(_ownersIndices[newOwners[i]] == 0, "Multiownable: all owners must be unique");
            _ownersIndices[newOwners[i]] = i + 1;
        }
        
        emit OwnershipTransferred(_owners, _requiredConfirmations, newOwners, requiredConfirmations);
        _owners = newOwners;
        _requiredConfirmations = requiredConfirmations;
        _allOperations.push(_allOperations[0]);
        _ownersGeneration++;
    }

    event OwnershipTransferred(address[] previousOwners, uint requiredConfirmations, address[] newOwners, uint newRequiredConfirmations);
    event OperationCreated(bytes32 operation, uint howMany, uint ownersCount, address proposer);
    event OperationUpvoted(bytes32 operation, uint votes, uint howMany, uint ownersCount, address upvoter);
    event OperationPerformed(bytes32 operation, uint howMany, uint ownersCount, address performer);
    event OperationDownvoted(bytes32 operation, uint votes, uint ownersCount,  address downvoter);
    event OperationCancelled(bytes32 operation, address lastCanceller);
}
