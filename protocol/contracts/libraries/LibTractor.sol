/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";

/**
 * @title Lib Tractor
 * @author funderbrker, 0xm00neth
 **/
library LibTractor {
    // 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
    // bytes32 constant TRACTOR_STORAGE_POSITION = keccak256("diamond.storage.tractor");

    enum CounterUpdateType {
        INCREASE,
        DECREASE
    }

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
        // Publisher Address => counter id => counter value.
        mapping(address => mapping(bytes32 => uint256)) blueprintCounters;
        // Publisher of current operations. Set to address(1) when no active publisher.
        address payable activePublisher;
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

    /**
     * @notice Stores blueprint, hash, and signature, which enables verification.
     */
    struct Requisition {
        Blueprint blueprint;
        bytes32 blueprintHash; // including this is not strictly necessary, but helps avoid hashing more than once on chain
        bytes signature;
    }

    /**
     * @notice Get tractor storage from storage.
     * @return ts Storage object containing tractor data
     */
    function _tractorStorage() internal pure returns (TractorStorage storage ts) {
        // keccak256("diamond.storage.tractor") == 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
        assembly {
            ts.slot := 0x7efbaaac9214ca1879e26b4df38e29a72561affb741bba775ce66d5bb6a82a07
        }
    }

    /**
     * @notice Increment the blueprint nonce by 1.
     * @param blueprintHash blueprint hash
     */
    function _incrementBlueprintNonce(bytes32 blueprintHash) internal {
        _tractorStorage().blueprintNonce[blueprintHash]++;
    }

    /**
     * @notice Cancel blueprint.
     * @dev set blueprintNonce to type(uint256).max
     * @param blueprintHash blueprint hash
     */
    function _cancelBlueprint(bytes32 blueprintHash) internal {
        _tractorStorage().blueprintNonce[blueprintHash] = type(uint256).max;
    }

    /**
     * @notice Set blueprint publisher address.
     * @param publisher blueprint publisher address
     */
    function _setPublisher(address payable publisher) internal {
        TractorStorage storage ts = _tractorStorage();
        require(uint160(bytes20(address(ts.activePublisher))) <= 1, "LibTractor: publisher already set");
        ts.activePublisher = publisher;
    }

    /**
     * @notice Reset blueprint publisher address.
     */
    function _resetPublisher() internal {
        _tractorStorage().activePublisher = payable(address(1));
    }

    /** @notice Return current activePublisher address.
     * @return publisher current activePublisher address
     */
    function _getActivePublisher() internal view returns (address payable) {
        return _tractorStorage().activePublisher;
    }

    /** @notice Return current activePublisher address or msg.sender if no active blueprint.
     * @return user to take actions on behalf of
     */
    function _user() internal view returns (address payable user) {
        user = _getActivePublisher();
        if (uint160(bytes20(address(user))) <= 1) {
            user = payable(msg.sender);
        }
    }

    /**
     * @notice Get blueprint nonce.
     * @param blueprintHash blueprint hash
     * @return nonce current blueprint nonce
     */
    function _getBlueprintNonce(bytes32 blueprintHash) internal view returns (uint256) {
        return _tractorStorage().blueprintNonce[blueprintHash];
    }

    /**
     * @notice Calculates blueprint hash.
     * @dev https://eips.ethereum.org/EIPS/eip-712
     * @dev  https://github.com/BeanstalkFarms/Beanstalk/pull/727#discussion_r1577293450
     * @param blueprint blueprint object
     * @return hash calculated Blueprint hash
     */
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
     * @notice Hashes in an EIP712 compliant way.
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
     * @notice Returns the domain separator for the current chain.
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
