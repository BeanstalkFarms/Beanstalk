/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {LibBytes} from "../../libraries/LibBytes.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";

import {LibTractor} from "../../libraries/LibTractor.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
/**
 * @title TractorFacet handles tractor and blueprint operations.
 * @author funderberker, 0xm00neth
 */
contract TractorFacet {
    using LibBytes for bytes32;
    using LibRedundantMath256 for uint256;

    event PublishRequisition(LibTractor.Requisition requisition);

    event CancelBlueprint(bytes32 blueprintHash);

    event Tractor(address indexed operator, bytes32 blueprintHash);

    /**
     * @notice Ensure requisition hash matches blueprint data and signer is publisher.
     */
    modifier verifyRequisition(LibTractor.Requisition calldata requisition) {
        bytes32 blueprintHash = LibTractor._getBlueprintHash(requisition.blueprint);
        require(blueprintHash == requisition.blueprintHash, "TractorFacet: invalid hash");
        address signer = ECDSA.recover(
            MessageHashUtils.toEthSignedMessageHash(requisition.blueprintHash),
            requisition.signature
        );
        require(signer == requisition.blueprint.publisher, "TractorFacet: signer mismatch");
        _;
    }

    /**
     * @notice Verify nonce and time are acceptable, increment nonce, set publisher, clear publisher.
     */
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

    /**
     * @notice Publish a new blueprint by emitting its data in an event.
     */
    function publishRequisition(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        emit PublishRequisition(requisition);
    }

    /**
     * @notice Destroy existing blueprint
     */
    function cancelBlueprint(
        LibTractor.Requisition calldata requisition
    ) external verifyRequisition(requisition) {
        require(msg.sender == requisition.blueprint.publisher, "TractorFacet: not publisher");
        LibTractor._cancelBlueprint(requisition.blueprintHash);
        emit CancelBlueprint(requisition.blueprintHash);
    }

    /**
     * @notice Execute a Tractor blueprint as an operator.
     */
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
            uint80 pasteCallIndex = operatorPasteInstr.getIndex1();
            require(calls.length > pasteCallIndex, "Tractor: pasteCallIndex OOB");

            LibBytes.pasteBytesTractor(
                operatorPasteInstr,
                operatorData,
                calls[pasteCallIndex].callData
            );
        }

        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            require(calls[i].callData.length != 0, "Tractor: empty AdvancedFarmCall");
            results[i] = LibFarm._advancedFarm(calls[i], results);
        }
        emit Tractor(msg.sender, requisition.blueprintHash);
    }

    /**
     * @notice Get current counter value.
     * @return count Counter value
     */
    function getCounter(bytes32 counterId) public view returns (uint256 count) {
        return
            LibTractor._tractorStorage().blueprintCounters[
                LibTractor._tractorStorage().activePublisher
            ][counterId];
    }

    /**
     * @notice Update counter value.
     * @return count New value of counter
     */
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

    /**
     * @notice Get current blueprint nonce.
     * @return nonce current blueprint nonce
     */
    function getBlueprintNonce(bytes32 blueprintHash) external view returns (uint256) {
        return LibTractor._getBlueprintNonce(blueprintHash);
    }

    /**
     * @notice Get EIP712 compliant hash of the blueprint.
     * @return hash Hash of Blueprint
     */
    function getBlueprintHash(
        LibTractor.Blueprint calldata blueprint
    ) external view returns (bytes32) {
        return LibTractor._getBlueprintHash(blueprint);
    }
}
