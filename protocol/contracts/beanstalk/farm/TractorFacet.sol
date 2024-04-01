/// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {ECDSA} from "@openzeppelin/contracts/cryptography/ECDSA.sol";
import {LibBytes} from "../../libraries/LibBytes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {LibTractor} from "../../libraries/LibTractor.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
/**
 * @title TractorFacet handles tractor and blueprint operations.
 * @author 0xm00neth, funderberker
 */
contract TractorFacet {
    using LibBytes for bytes32;
    using SafeMath for uint256;

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
        LibTractor._setPublisher(payable(requisition.blueprint.publisher));
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
        require(requisition.blueprint.data.length > 0, "Tractor: data empty");

        // Decode and execute advanced farm calls.
        // Cut out blueprint calldata selector.
        AdvancedFarmCall[] memory calls = abi.decode(
            LibBytes.sliceFrom(requisition.blueprint.data, 4),
            (AdvancedFarmCall[])
        );

        // Update data with operator-defined fillData.
        for (uint256 i; i < requisition.blueprint.operatorPasteInstrs.length; ++i) {
            bytes32 operatorPasteInstr = requisition.blueprint.operatorPasteInstrs[i];

            // note: calls[..] reverts if operatorPasteInstr.getPasteCallIndex()
            // is an invalid index.
            LibBytes.pasteBytesTractor(
                operatorPasteInstr,
                operatorData,
                calls[operatorPasteInstr.getPasteCallIndex()].callData
            );
        }

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Tractor: empty AdvancedFarmCall");
            results[i] = LibFarm._advancedFarmMem(calls[i], results);
        }
        emit Tractor(msg.sender, requisition.blueprintHash);
    }

    /// @notice get counter count
    /// @return count counter count
    function getCounter(bytes32 counterId) public view returns (uint256 count) {
        return
            LibTractor._tractorStorage().blueprintCounters[
                LibTractor._tractorStorage().activePublisher
            ][counterId];
    }

    /// @notice update counter count
    /// @return count counter count
    function updateCounter(
        bytes32 counterId,
        LibTractor.CounterUpdateType updateType,
        uint256 amount
    ) external returns (uint256 count) {
        uint256 newCount;
        if (updateType == LibTractor.CounterUpdateType.INCREASE) {
            newCount = getCounter(counterId).add(amount);
        } else if (updateType == LibTractor.CounterUpdateType.DECREASE) {
            newCount = getCounter(counterId).sub(amount);
        }
        LibTractor._tractorStorage().blueprintCounters[
            LibTractor._tractorStorage().activePublisher
        ][counterId] = newCount;
        return newCount;
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
