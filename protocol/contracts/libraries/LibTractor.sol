/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

/**
 * @title Lib Tractor
 * @author 0xm00neth
 **/
library LibTractor {
    bytes32 constant TRACTOR_STORAGE_POSITION =
        keccak256("diamond.storage.tractor");

    struct TractorStorage {
        mapping(bytes32 => uint256) blueprintNonce;
        address activePublisher;
    }

    // Blueprint stores blueprint related values
    struct Blueprint {
        address publisher;
        bytes data;
        bytes32[] calldataCopyParams;
        uint256 maxNonce;
        uint256 startTime;
        uint256 endTime;
        bytes signature;
    }

    /// @notice get tractor storage from storage
    /// @return ts TractorStorage
    function tractorStorage()
        internal
        pure
        returns (TractorStorage storage ts)
    {
        bytes32 position = TRACTOR_STORAGE_POSITION;
        assembly {
            ts.slot := position
        }
    }

    /// @notice increment the blueprint nonce by 1
    /// @param blueprintHash blueprint hash
    function incrementBlueprintNonce(bytes32 blueprintHash) internal {
        TractorStorage storage ts = tractorStorage();
        ++ts.blueprintNonce[blueprintHash];
    }

    /// @notice cancel blueprint
    /// @dev set blueprintNonce to type(uint256).max
    /// @param blueprintHash blueprint hash
    function cancelBlueprint(bytes32 blueprintHash) internal {
        tractorStorage().blueprintNonce[blueprintHash] = type(uint256).max;
    }

    /// @notice set blueprint publisher address
    /// @param publisher blueprint publisher address
    function setPublisher(address publisher) internal {
        require(
            tractorStorage().activePublisher == address(0) ||
                tractorStorage().activePublisher == address(1),
            "LibTractor: publisher already set"
        );
        tractorStorage().activePublisher = publisher;
    }

    /// @notice reset blueprint publisher address
    function resetPublisher() internal {
        tractorStorage().activePublisher = address(1);
    }

    /// @notice return current activePublisher address
    /// @return publisher current activePublisher address
    function getBlueprintPublisher() internal view returns (address) {
        return tractorStorage().activePublisher;
    }

    /// @notice return current activePublisher address
    /// @dev reverts if activePublisher is 0x0
    /// @return publisher current activePublisher address
    function getActivePublisher() internal view returns (address publisher) {
        publisher = getBlueprintPublisher();
        require(publisher != address(1), "Tractor: No active publisher");
    }

    /// @notice calculates blueprint hash
    /// @param blueprint blueprint object
    /// @return hash calculated Blueprint hash
    function getBlueprintHash(Blueprint calldata blueprint)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    blueprint.publisher,
                    blueprint.data,
                    blueprint.calldataCopyParams,
                    blueprint.maxNonce,
                    blueprint.startTime,
                    blueprint.endTime
                )
            );
    }

    /// @notice get blueprint nonce
    /// @param blueprintHash blueprint hash
    /// @return nonce current blueprint nonce
    function getBlueprintNonce(bytes32 blueprintHash)
        internal
        view
        returns (uint256)
    {
        return tractorStorage().blueprintNonce[blueprintHash];
    }
}
