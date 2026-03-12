// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./FundSplitter.sol";

/**
 * @title FundSplitterFactory
 * @notice Deploys EIP-1167 minimal proxy clones of FundSplitter.
 * @dev Uses CREATE2 via cloneDeterministic for predictable addresses.
 */
contract FundSplitterFactory {
    address public immutable implementation;

    event SplitCreated(address indexed splitAddress, address indexed creator, string name);

    constructor() {
        implementation = address(new FundSplitter());
    }

    /**
     * @notice Create a new fund-splitting clone contract.
     * @param _name Display name for the split.
     * @param _wallets Recipient wallet addresses.
     * @param _shares Recipient shares in basis points (must sum to 10000).
     */
    function createSplit(
        string calldata _name,
        address payable[] calldata _wallets,
        uint16[] calldata _shares
    ) external returns (address split) {
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, _name));
        split = _cloneDeterministic(implementation, salt);

        FundSplitter(payable(split)).initialize(_name, msg.sender, _wallets, _shares);

        emit SplitCreated(split, msg.sender, _name);
    }

    /**
     * @notice Predict the address of a split before deployment.
     */
    function predictAddress(address _creator, string calldata _name) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_creator, _name));
        return _predictDeterministicAddress(implementation, salt);
    }

    // --- EIP-1167 Minimal Proxy (inline, no OZ dependency) ---

    function _cloneDeterministic(address impl, bytes32 salt) internal returns (address instance) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, ptr, 0x37, salt)
        }
        require(instance != address(0), "Clone failed");
    }

    function _predictDeterministicAddress(address impl, bytes32 salt) internal view returns (address predicted) {
        bytes32 bytecodeHash;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            bytecodeHash := keccak256(ptr, 0x37)
        }
        predicted = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }
}
