/// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../ReentrancyGuard.sol";
import "../../libraries/LibBytes.sol";
import "../../libraries/LibFarm.sol";
import "../../libraries/LibTractor.sol";
import "../../libraries/LibPermit.sol";

/**
 * @title TractorFacet handles tractor and blueprint operations.
 * @author 0xm00neth
 */
contract TractorFacet is ReentrancyGuard {
    using ECDSA for bytes32;

    /*********/
    /* Enums */
    /*********/

    /// @notice Blueprint type enum
    enum BlueprintType {
        NORMAL,
        ADVANCED
    }

    /**********/
    /* Events */
    /**********/

    /// @dev Emitted on publishBlueprint()
    /// @param blueprint Blueprint object
    event PublishBlueprint(LibTractor.Blueprint blueprint);

    /// @dev Emitted on destroyBlueprint()
    /// @param blueprintHash Blueprint Hash
    event DestroyBlueprint(bytes32 blueprintHash);

    /// @dev Emitted on tractor()
    /// @param operator The operator address
    /// @param blueprintHash Blueprint Hash
    event Tractor(address indexed operator, bytes32 blueprintHash);

    /*************/
    /* Modifiers */
    /*************/

    modifier verifySignature(LibTractor.Blueprint calldata blueprint) {
        // get blueprint hash
        bytes32 blueprintHash = LibTractor.getBlueprintHash(blueprint);

        bytes32 hash = blueprintHash.toEthSignedMessageHash();

        address signer = hash.recover(blueprint.signature);
        require(
            signer == blueprint.publisher,
            "TractorFacet: invalid signature"
        );

        _;
    }

    /******************/
    /* User Functions */
    /******************/

    /// @notice Publish new blueprint
    ///
    /// Emits {PublishBlueprint} event
    ///
    /// @param blueprint Blueprint object
    function publishBlueprint(LibTractor.Blueprint calldata blueprint)
        external
        verifySignature(blueprint)
    {
        // emits event
        emit PublishBlueprint(blueprint);
    }

    /// @notice Destroy existing blueprint
    ///
    /// Emits {DestroyBlueprint} event
    ///
    /// @param blueprint Blueprint object
    function destroyBlueprint(LibTractor.Blueprint calldata blueprint)
        external
        verifySignature(blueprint)
    {
        // get blueprint hash
        bytes32 blueprintHash = LibTractor.getBlueprintHash(blueprint);

        // cancel blueprint
        LibTractor.cancelBlueprint(blueprintHash);

        // emits event
        emit DestroyBlueprint(blueprintHash);
    }

    /// @notice return current blueprint nonce
    /// @param blueprint Blueprint object
    /// @return nonce current blueprint nonce
    function blueprintNonce(LibTractor.Blueprint calldata blueprint)
        external
        view
        returns (uint256)
    {
        // get blueprint hash
        bytes32 blueprintHash = LibTractor.getBlueprintHash(blueprint);

        return LibTractor.getBlueprintNonce(blueprintHash);
    }

    /// @notice Tractor Operation
    ///
    /// Emits {Tractor} event
    ///
    /// @param blueprint Blueprint object
    /// @param callData callData inputed by tractor operator
    function tractor(
        LibTractor.Blueprint calldata blueprint,
        bytes calldata callData
    )
        external
        payable
        verifySignature(blueprint)
        returns (bytes[] memory results)
    {
        require(
            blueprint.startTime < block.timestamp &&
                block.timestamp < blueprint.endTime,
            "TractorFacet: blueprint is not active"
        );

        // check/increment blueprint nonce
        {
            // get blueprint hash
            bytes32 blueprintHash = LibTractor.getBlueprintHash(blueprint);

            // get blueprint nonce
            uint256 nonce = LibTractor.getBlueprintNonce(blueprintHash);

            require(
                nonce < blueprint.maxNonce,
                "TractorFacet: maxNonce reached"
            );

            // increment blueprint nonce
            LibTractor.incrementBlueprintNonce(blueprintHash);

            // emits event
            emit Tractor(msg.sender, blueprintHash);
        }

        // set blueprint publisher
        LibTractor.setPublisher(blueprint.publisher);

        // extract blueprint type and data from blueprint.data
        bytes1 blueprintType = blueprint.data[0];
        bytes memory blueprintData = LibBytes.sliceFrom(blueprint.data, 1);
        {
            // copy callData
            uint256 copyParamsLength = blueprint.calldataCopyParams.length;
            for (uint256 i; i != copyParamsLength; ++i) {
                // bytes32 copyParams
                // [ 2 bytes | 10 bytes  |  10 bytes  | 10 bytes ]
                // [   N/A   | copyIndex | pasteIndex |  length  ]
                bytes32 copyParams = blueprint.calldataCopyParams[i];
                uint80 copyIndex = uint80(uint256((copyParams << 16) >> 176));
                uint80 pasteIndex = uint80(uint256((copyParams << 96) >> 176));
                uint80 length = uint80(uint256((copyParams << 176) >> 176));

                if (copyIndex == type(uint80).max) {
                    LibFunction.paste32Bytes(
                        abi.encodePacked(bytes32(uint256(uint160(msg.sender)))),
                        blueprintData,
                        32,
                        pasteIndex
                    );
                } else {
                    LibFunction.pasteBytes(
                        callData,
                        blueprintData,
                        copyIndex,
                        pasteIndex,
                        length
                    );
                }
            }
        }

        if (uint8(blueprintType) == uint8(BlueprintType.NORMAL)) {
            // decode farm calldata
            bytes[] memory data = abi.decode(blueprintData, (bytes[]));

            // call farm function
            results = new bytes[](data.length);
            for (uint256 i; i != data.length; ++i) {
                results[i] = LibFarm.farmMem(data[i]);
            }
        } else if (uint8(blueprintType) == uint8(BlueprintType.ADVANCED)) {
            // decode farm calldata
            LibFarm.AdvancedFarmCall[] memory data = abi.decode(
                blueprintData,
                (LibFarm.AdvancedFarmCall[])
            );

            // call advancedFarm function
            results = new bytes[](data.length);
            for (uint256 i = 0; i < data.length; ++i) {
                results[i] = LibFarm.advancedFarmMem(data[i], results);
            }
        } else {
            revert("TractorFacet: unknown blueprint type");
        }

        // reset blueprint publisher
        LibTractor.resetPublisher();
    }
}
