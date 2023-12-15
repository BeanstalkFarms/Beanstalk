/// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

// TODO rm
// import "forge-std/console.sol";
import "hardhat/console.sol";

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../ReentrancyGuard.sol";
import "../../libraries/LibBytes.sol";
import {LibTractor} from "../../libraries/LibTractor.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibOperatorPasteInstr} from "../../libraries/LibOperatorPasteInstr.sol";

/**
 * @title TractorFacet handles tractor and blueprint operations.
 * @author 0xm00neth, funderberker
 */
contract TractorFacet is ReentrancyGuard {
    using LibOperatorPasteInstr for bytes32;

    /**********/
    /* Events */
    /**********/

    /// @dev Emitted on publishRequisition()
    event PublishRequisition(LibTractor.Requisition requisition);

    /// @dev Emitted on cancelBlueprint()
    event CancelBlueprint(bytes32 blueprintHash);

    /// @dev Emitted on tractor()
    event Tractor(address indexed operator, bytes32 blueprintHash);

    /*************/
    /* Modifiers */
    /*************/

    modifier verifyRequisition(LibTractor.Requisition calldata requisition) {
        bytes32 blueprintHash = LibTractor._getBlueprintHash(requisition.blueprint);
        require(blueprintHash == requisition.blueprintHash, "TractorFacet: invalid hash");
        address signer = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(requisition.blueprintHash),
            requisition.signature
        );
        console.log("blueprintHash:");
        console.logBytes32(blueprintHash);
        console.log("signature:");
        console.logBytes(requisition.signature);
        console.log("signer: %s", signer);
        require(signer == requisition.blueprint.publisher, "TractorFacet: signer mismatch");
        _;
    }

    /// @notice Check blueprint nonce, increment nonce, handle active publisher.
    modifier runBlueprint(LibTractor.Requisition calldata requisition) {
        require(
            LibTractor._getBlueprintNonce(requisition.blueprintHash) <
                requisition.blueprint.maxNonce,
            "TractorFacet: maxNonce reached"
        );
        require(
            requisition.blueprint.startTime <= block.timestamp &&
                block.timestamp <= requisition.blueprint.endTime,
            "TractorFacet: blueprint is not active"
        );
        LibTractor._incrementBlueprintNonce(requisition.blueprintHash);
        LibTractor._setPublisher(requisition.blueprint.publisher);
        _;
        LibTractor._resetPublisher();
    }

    /******************/
    /* User Functions */
    /******************/

    /// @notice Publish new blueprint
    /// Emits {PublishRequisition} event
    function publishRequisition(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        emit PublishRequisition(requisition);
    }

    /// @notice Destroy existing blueprint
    /// Emits {CancelBlueprint} event
    function cancelBlueprint(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        require(msg.sender == requisition.blueprint.publisher, "TractorFacet: not publisher");
        LibTractor._cancelBlueprint(requisition.blueprintHash);
        emit CancelBlueprint(requisition.blueprintHash);
    }

    /// @notice Tractor Operation
    /// Emits {Tractor} event
    function tractor(
        LibTractor.Requisition calldata requisition,
        bytes memory operatorData
    )
        external
        payable
        verifyRequisition(requisition)
        runBlueprint(requisition)
        returns (bytes[] memory results)
    {
        console.log("HERE1");
        console.logBytes(requisition.blueprint.data);
        require(requisition.blueprint.data.length > 0, "Tractor: data empty");

        console.log("HERE2");

        // Decode and execute advanced farm calls.
        // Cut out blueprint calldata selector.
        AdvancedFarmCall[] memory calls = abi.decode(
            LibBytes.sliceFrom(requisition.blueprint.data, 4),
            (AdvancedFarmCall[])
        );

        console.log("HERE3");

        // Update data with operator-defined fillData.
        uint80 pasteCallIndex;
        for (uint256 i; i < requisition.blueprint.operatorPasteInstrs.length; ++i) {
            bytes32 operatorPasteInstr = requisition.blueprint.operatorPasteInstrs[i];
            pasteCallIndex = operatorPasteInstr.pasteCallIndex();
            console.log("pasteCallIndex: %s", pasteCallIndex);
            require(calls.length > pasteCallIndex, "Tractor: operator pasteCallIndex OOB");
            LibOperatorPasteInstr.pasteBytes(
                operatorPasteInstr,
                operatorData,
                calls[pasteCallIndex].callData
            );
        }

        console.log("HERE4");

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Tractor: empty AdvancedFarmCall");
            console.logBytes(calls[i].callData);
            results[i] = LibFarm._advancedFarmMem(calls[i], results);
        }

        console.log("HERE5");

        emit Tractor(msg.sender, requisition.blueprintHash);
    }

    /// @notice return current blueprint nonce
    /// @return nonce current blueprint nonce
    function getBlueprintNonce(bytes32 blueprintHash) external view returns (uint256) {
        return LibTractor._getBlueprintNonce(blueprintHash);
    }

    /// @notice return EIP712 hash of the blueprint
    /// @return hash calculated Blueprint hash
    function getBlueprintHash(
        LibTractor.Blueprint calldata blueprint
    ) external view returns (bytes32) {
        return LibTractor._getBlueprintHash(blueprint);
    }
}
