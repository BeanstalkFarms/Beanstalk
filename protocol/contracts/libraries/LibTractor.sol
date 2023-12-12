/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {C} from "contracts/C.sol";

/**
 * @title Lib Tractor
 * @author 0xm00neth, funderbrker
 **/
library LibTractor {
    // 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
    // bytes32 constant TRACTOR_STORAGE_POSITION = keccak256("diamond.storage.tractor");

    bytes32 private constant TRACTOR_HASHED_NAME = keccak256(bytes("Tractor"));
    bytes32 private constant TRACTOR_HASHED_VERSION = keccak256(bytes("1"));
    bytes32 private constant EIP712_TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant BLUEPRINT_TYPE_HASH =
        keccak256(
            "Blueprint(address publisher,bytes data,bytes operatorData,uint256 maxNonce,uint256 startTime,uint256 endTime)"
        );

    struct TractorStorage {
        // Number of times the blueprint has been run.
        mapping(bytes32 => uint256) blueprintNonce;
        // Blueprint hash => counter index => counter value.
        mapping(bytes32 => mapping(uint256 => uint256)) blueprintCounters;
        // Publisher of current operations. Set to address(1) when no active publisher.
        address activePublisher;
    }

    // Blueprint stores blueprint related values
    struct Blueprint {
        address publisher;
        bytes data;
        bytes32[] operatorPasteInstrs;
        uint256 maxNonce;
        uint256 startTime;
        uint256 endTime;
    }

    // Requisition stores blueprint, hash, and signature, which enables verification.
    struct Requisition {
        Blueprint blueprint;
        bytes32 blueprintHash; // including this is not strictly necessary, but helps avoid hashing more than once on chain
        bytes signature;
    }

    /// @notice get tractor storage from storage
    /// @return ts TractorStorage
    function _tractorStorage() internal view returns (TractorStorage storage ts) {
        // keccak256("diamond.storage.tractor") == 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
        assembly {
            ts.slot := 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
        }
    }

    /// @notice increment the blueprint nonce by 1
    /// @param blueprintHash blueprint hash
    function _incrementBlueprintNonce(bytes32 blueprintHash) internal {
        TractorStorage storage ts = _tractorStorage();
        ++ts.blueprintNonce[blueprintHash];
    }

    /// @notice cancel blueprint
    /// @dev set blueprintNonce to type(uint256).max
    /// @param blueprintHash blueprint hash
    function _cancelBlueprint(bytes32 blueprintHash) internal {
        _tractorStorage().blueprintNonce[blueprintHash] = type(uint256).max;
    }

    /// @notice set blueprint publisher address
    /// @param publisher blueprint publisher address
    function _setPublisher(address publisher) internal {
        require(
            _tractorStorage().activePublisher == address(1),
            "LibTractor: publisher already set"
        );
        _tractorStorage().activePublisher = publisher;
    }

    /// @notice reset blueprint publisher address
    function _resetPublisher() internal {
        _tractorStorage().activePublisher = address(1);
    }

    /// @notice return current activePublisher address
    /// @return publisher current activePublisher address
    function _getActivePublisher() internal view returns (address) {
        return _tractorStorage().activePublisher;
    }

    // TODO gas golf harder.
    /// @notice return current activePublisher address or msg.sender if no active blueprint
    /// @return user to take actions on behalf of
    function _getUser() internal view returns (address user) {
        user = _getActivePublisher();
        if (user == address(1)) {
            user = msg.sender;
        }
    }

    /// @notice get blueprint nonce
    /// @param blueprintHash blueprint hash
    /// @return nonce current blueprint nonce
    function _getBlueprintNonce(bytes32 blueprintHash) internal view returns (uint256) {
        return _tractorStorage().blueprintNonce[blueprintHash];
    }

    /// @notice calculates blueprint hash
    /// @param blueprint blueprint object
    /// @return hash calculated Blueprint hash
    function _getBlueprintHash(Blueprint calldata blueprint) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        BLUEPRINT_TYPE_HASH,
                        blueprint.publisher,
                        keccak256(blueprint.data),
                        keccak256(abi.encodePacked(blueprint.operatorPasteInstrs)),
                        blueprint.maxNonce,
                        blueprint.startTime,
                        blueprint.endTime
                    )
                )
            );
    }

    /**
     * @dev Returns an Ethereum Signed Typed Data, created from a
     * `domainSeparator` and a `structHash`. This produces hash corresponding
     * to the one signed with the
     * https://eips.ethereum.org/EIPS/eip-712[`eth_signTypedData`]
     * JSON-RPC method as part of EIP-712.
     *
     * Sourced from OpenZeppelin 0.8 ECDSA lib.
     */
    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    /**
     * @dev Returns the domain separator for the current chain.
     */
    function _domainSeparatorV4() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    BLUEPRINT_TYPE_HASH,
                    TRACTOR_HASHED_NAME,
                    TRACTOR_HASHED_VERSION,
                    C.getChainId(),
                    address(this)
                )
            );
    }
}
