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
    /*********/
    /* Enums */
    /*********/

    /// @notice Blueprint type enum
    enum BlueprintType {
        NULL,
        ADVANCED_FARM
    }

    /**********/
    /* Events */
    /**********/

    /// @dev Emitted on publishBlueprint()
    /// @param blueprint Blueprint object
    event PublishBlueprint(LibTractor.Requisition requisition);

    /// @dev Emitted on cancelBlueprint()
    /// @param blueprintHash Blueprint Hash
    event CancelBlueprint(bytes32 blueprintHash);

    /// @dev Emitted on tractor()
    /// @param operator The operator address
    /// @param blueprintHash Blueprint Hash
    event Tractor(address indexed operator, bytes32 blueprintHash);

    /*************/
    /* Modifiers */
    /*************/

    modifier verifyRequisition(LibTractor.Requisition calldata requisition) {
        bytes32 blueprintHash = LibTractor._getBlueprintHash(requisition);
        require(blueprintHash == blueprint.blueprintHash, "TractorFacet: invalid hash");
        address signer = ECDSA.recover(blueprintHash, signature);
        require(signer == blueprint.publisher, "TractorFacet: invalid signer");
        _;
    }

    /// @notice Check blueprint nonce, increment nonce, handle active publisher.
    modifier runBlueprint(LibTractor.Blueprint calldata blueprint) {
        require(
            LibTractor._getBlueprintNonce(requisition.blueprintHash) < blueprint.maxNonce,
            "TractorFacet: maxNonce reached"
        );
        require(
            blueprint.startTime <= block.timestamp && block.timestamp <= blueprint.endTime,
            "TractorFacet: blueprint is not active"
        );
        LibTractor._incrementBlueprintNonce(requisition.blueprintHash);
        LibTractor._setPublisher(blueprint.publisher);
        _;
        LibTractor._resetPublisher();
    }

    /******************/
    /* User Functions */
    /******************/

    /// @notice Publish new blueprint
    /// Emits {PublishBlueprint} event
    /// @param blueprint Blueprint object
    function publishBlueprint(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        emit PublishBlueprint(requisition);
    }

    /// @notice Destroy existing blueprint
    /// Emits {CancelBlueprint} event
    /// @param blueprint Blueprint object
    function cancelBlueprint(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        require(msg.sender == blueprint.publisher, "TractorFacet: not publisher");
        LibTractor._cancelBlueprint(requisition.blueprintHash);
        emit CancelBlueprint(requisition.blueprintHash);
    }

    /// @notice Tractor Operation
    /// Emits {Tractor} event
    /// @param blueprint Blueprint object
    /// @param fillData data updates provided by tractor operator
    function tractor(
        LibTractor.Requisition calldata requisition,
        bytes calldata fillData
    )
        external
        payable
        verifyRequisition(requisition)
        runBlueprint(requisition)
        returns (bytes[] memory results)
    {
        // extract blueprint type and publisher data from blueprint.data.
        bytes1 blueprintType = blueprint.data[0];
        bytes memory blueprintData = LibBytes.sliceFrom(blueprint.data, 1);

        // Update data with operator-defined fillData.
        {
            uint64 copyIndex;
            for (uint256 i; i != blueprint.unsetData.length; ++i) {
                bytes32 pasteReference = blueprint.unsetData[i];
                LibFunction.pasteBytes(
                    fillData,
                    blueprintData,
                    copyIndex,
                    pasteReference.index,
                    pasteReference.length
                );
                copyIndex += pasteReference.length;
            }
        }

        // Decode and execute advanced farm calls.
        if (uint8(blueprintType) == uint8(BlueprintType.ADVANCED_FARM)) {
            LibFarm.AdvancedFarmCall[] memory data = abi.decode(
                blueprintData,
                (LibFarm.AdvancedFarmCall[])
            );

            results = new bytes[](data.length);
            for (uint256 i = 0; i < data.length; ++i) {
                results[i] = LibFarm.advancedFarm(data[i], results);
            }
        } else {
            revert("TractorFacet: unknown blueprint type");
        }

        emit Tractor(msg.sender, requisition.blueprintHash);
    }

    /// @notice return current blueprint nonce
    /// @param blueprint Blueprint object
    /// @return nonce current blueprint nonce
    function getBlueprintNonce(bytes32 calldata blueprintHash) external view returns (uint256) {
        return LibTractor._getBlueprintNonce(blueprintHash);
    }

    /// @notice return EIP712 hash of the blueprint
    /// @param blueprint Blueprint object
    /// @return hash calculated Blueprint hash
    function getBlueprintHash(
        LibTractor.Blueprint calldata blueprint
    ) external pure returns (bytes32) {
        return LibTractor._getBlueprintHash(blueprint);
    }
}
