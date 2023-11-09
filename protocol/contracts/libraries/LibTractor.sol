/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

/**
 * @title Lib Tractor
 * @author 0xm00neth
 **/
library LibTractor {
    bytes32 constant TRACTOR_STORAGE_POSITION = keccak256("diamond.storage.tractor");

    bytes32 private constant TRACTOR_HASHED_NAME = keccak256(bytes("Tractor"));
    bytes32 private constant TRACTOR_HASHED_VERSION = keccak256(bytes("1"));
    bytes32 private constant EIP712_TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant BLUEPRINT_TYPE_HASH =
        keccak256(
            "Blueprint(address publisher,bytes data,bytesReference[] unsetData,uint256 maxNonce,uint256 startTime,uint256 endTime)"
        );

    struct TractorStorage {
        mapping(bytes32 => uint256) blueprintNonce;
        address activePublisher;
    }

    // NOTE(funderberker): Performance cost of using a <32 bytes struct vs packed bytes32 ?
    struct bytesReference {
        uint64 index;
        uint64 length;
    }

    // Blueprint stores blueprint related values
    struct Blueprint {
        address publisher;
        bytes data;
        bytesReference[] unsetData;
        uint256 maxNonce;
        uint256 startTime;
        uint256 endTime;
    }

    // SignedBlueprint stores blueprint, hash, and signature, which enables verification.
    struct SignedBlueprint {
        Blueprint blueprint;
        bytes32 blueprintHash; // including this is not strictly necessary, but helps avoid hashing more than once on chain
        bytes signature;
    }

    /// @notice get tractor storage from storage
    /// @return ts TractorStorage
    function _tractorStorage() internal pure returns (TractorStorage storage ts) {
        bytes32 position = TRACTOR_STORAGE_POSITION;
        assembly {
            ts.slot := position
        }
    }

    /// @notice increment the blueprint nonce by 1
    /// @param blueprintHash blueprint hash
    function _incrementBlueprintNonce(bytes32 blueprintHash) internal {
        TractorStorage storage ts = tractorStorage();
        ++ts.blueprintNonce[blueprintHash];
    }

    /// @notice cancel blueprint
    /// @dev set blueprintNonce to type(uint256).max
    /// @param blueprintHash blueprint hash
    function _cancelBlueprint(bytes32 blueprintHash) internal {
        tractorStorage().blueprintNonce[blueprintHash] = type(uint256).max;
    }

    /// @notice set blueprint publisher address
    /// @param publisher blueprint publisher address
    function _setPublisher(address publisher) internal {
        require(
            tractorStorage().activePublisher == address(0) ||
                tractorStorage().activePublisher == address(1),
            "LibTractor: publisher already set"
        );
        tractorStorage().activePublisher = publisher;
    }

    /// @notice reset blueprint publisher address
    function _resetPublisher() internal {
        tractorStorage().activePublisher = address(1);
    }

    /// @notice return current activePublisher address
    /// @return publisher current activePublisher address
    function _getBlueprintPublisher() internal view returns (address) {
        return tractorStorage().activePublisher;
    }

    /// @notice return current activePublisher address
    /// @dev reverts if activePublisher is 0x0
    /// @return publisher current activePublisher address
    function _getActivePublisher() internal view returns (address publisher) {
        publisher = getBlueprintPublisher();
        require(publisher != address(1), "Tractor: No active publisher");
    }

    /// @notice get blueprint nonce
    /// @param blueprintHash blueprint hash
    /// @return nonce current blueprint nonce
    function _getBlueprintNonce(bytes32 blueprintHash) internal view returns (uint256) {
        return tractorStorage().blueprintNonce[blueprintHash];
    }

    /// @notice calculates blueprint hash
    /// @param blueprint blueprint object
    /// @return hash calculated Blueprint hash
    function _getBlueprintHash(Blueprint calldata blueprint) internal pure returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        BLUEPRINT_TYPE_HASH,
                        blueprint.publisher,
                        keccak256(blueprint.data),
                        keccak256(abi.encodePacked(blueprint.unsetData)),
                        blueprint.maxNonce,
                        blueprint.startTime,
                        blueprint.endTime
                    )
                )
            );
    }

    /**
     * @dev See {ECDSA.toTypedDataHash}.
     */
    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return ECDSA.toTypedDataHash(_domainSeparatorV4(), structHash);
    }

    /**
     * @dev Returns the domain separator for the current chain.
     */
    function _domainSeparatorV4() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_TYPE_HASH,
                    TRACTOR_HASHED_NAME,
                    TRACTOR_HASHED_VERSION,
                    C.getChainId(),
                    address(this)
                )
            );
    }
}
