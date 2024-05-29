// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {C} from "contracts/C.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {ShipmentRecipient} from "contracts/beanstalk/storage/System.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";

/**
 * @title LibReceiving
 * @author funderbrker
 * @notice Holds the logic responsible for receiving Bean shipments after mints. These
 *  functions must be delegatecalled from inside of the Beanstalk Diamond. If new receiving components
 *  are needed, this library and its calling Facet will need to be updated.
 * @dev An alternative design could remove the need for the generalized receive() entry function
 *  and instead require the shipping route to define the selector of its own corresponding receive
 *  function. However, both designs will require a Facet cut if a new receive function is needed,
 *  so this design was chosen for additional clarity.
 * @dev Functions are internal, but only pulled into LibShipping. Reduces the size of facet.
 */
library LibReceiving {
    using SafeCast for uint256;

    /**
     * @notice Emitted during Sunrise when Beans mints are shipped through active routes.
     * @param recipient The receiver.
     * @param receivedAmount The amount of Beans successfully received and processed.
     * @param data The data the Beans were received with. Optional.
     */
    event Receipt(ShipmentRecipient indexed recipient, uint256 receivedAmount, bytes data);

    /**
     * @notice General entry point to receive Beans at a given component of the system.
     * @param recipient The Beanstalk component that will receive the Beans.
     * @param shipmentAmount The amount of Beans to receive.
     * @param data Additional data to pass to the receiving function.
     */
    function receiveShipment(
        ShipmentRecipient recipient,
        uint256 shipmentAmount,
        bytes memory data
    ) internal {
        if (recipient == ShipmentRecipient.SILO) {
            siloReceive(shipmentAmount, data);
        } else if (recipient == ShipmentRecipient.FIELD) {
            fieldReceive(shipmentAmount, data);
        } else if (recipient == ShipmentRecipient.BARN) {
            barnReceive(shipmentAmount, data);
        }
        // New receiveShipment enum values should have a corresponding function call here.
    }

    /**
     * @notice Receive Beans at the Silo, distributing Stalk & Earned Beans.
     * @dev Data param not used.
     * @param shipmentAmount Amount of Beans to receive.
     */
    function siloReceive(uint256 shipmentAmount, bytes memory) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // `s.earnedBeans` is an accounting mechanism that tracks the total number
        // of Earned Beans that are claimable by Stalkholders. When claimed via `plant()`,
        // it is decremented. See {Silo.sol:_plant} for more details.
        s.sys.silo.earnedBeans += shipmentAmount.toUint128();

        // Mint Stalk (as Earned Stalk).
        // Stalk is created here because only Beans that are allocated to the Silo receive Stalk.
        s.sys.silo.stalk += (shipmentAmount * C.STALK_PER_BEAN);

        // SafeCast unnecessary here because of prior safe cast.
        s.sys.silo.balances[C.BEAN].deposited += uint128(shipmentAmount);
        s.sys.silo.balances[C.BEAN].depositedBdv += uint128(shipmentAmount);

        // Confirm successful receipt.
        emit Receipt(ShipmentRecipient.SILO, shipmentAmount, abi.encode(""));
    }

    /**
     * @notice Receive Beans at the Field. The next `shipmentAmount` Pods become harvestable.
     * @dev Amount should never exceed the number of Pods that are not yet Harvestable.
     * @param shipmentAmount Amount of Beans to receive.
     * @param data Encoded uint256 containing the index of the Field to receive the Beans.
     */
    function fieldReceive(uint256 shipmentAmount, bytes memory data) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 fieldId = abi.decode(data, (uint256));
        require(fieldId < s.sys.fieldCount, "Field does not exist");
        s.sys.fields[fieldId].harvestable += shipmentAmount;

        // Confirm successful receipt.
        emit Receipt(ShipmentRecipient.FIELD, shipmentAmount, data);
    }

    /**
     * @notice Receive Beans at the Barn. Amount of Sprouts become Rinsible.
     * @dev Data param not used.
     * @dev Rounding here can cause up to s.sys.fert.activeFertilizer / 1e6 Beans to be lost. Currently there are 17,217,105 activeFertilizer. So up to 17.217 Beans can be lost.
     * @param shipmentAmount Amount of Beans to receive.
     */
    function barnReceive(uint256 shipmentAmount, bytes memory) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 amountToFertilize = shipmentAmount + s.sys.fert.leftoverBeans;

        // Get the new Beans per Fertilizer and the total new Beans per Fertilizer
        // Zeroness of activeFertilizer handled in Planner.
        uint256 remainingBpf = amountToFertilize / s.sys.fert.activeFertilizer;
        uint256 oldBpf = s.sys.fert.bpf;
        uint256 newBpf = oldBpf + remainingBpf;

        // Get the end BPF of the first Fertilizer to run out.
        uint256 firstBpf = s.sys.fert.fertFirst;

        uint256 deltaFertilized;

        // If the next fertilizer is going to run out, then step BPF according
        while (newBpf >= firstBpf) {
            // Increment the cumulative change in Fertilized.
            deltaFertilized += (firstBpf - oldBpf) * s.sys.fert.activeFertilizer; // fertilizer between init and next cliff

            if (LibFertilizer.pop()) {
                oldBpf = firstBpf;
                firstBpf = s.sys.fert.fertFirst;
                // Calculate BPF beyond the first Fertilizer edge.
                remainingBpf = (amountToFertilize - deltaFertilized) / s.sys.fert.activeFertilizer;
                newBpf = oldBpf + remainingBpf;
            }
            // Else, if there is no more fertilizer. Matches plan cap.
            else {
                s.sys.fert.bpf = uint128(firstBpf); // SafeCast unnecessary here.
                s.sys.fert.fertilizedIndex += deltaFertilized;
                require(amountToFertilize == deltaFertilized, "Inexact amount of Beans at Barn");
                require(s.sys.fert.fertilizedIndex == s.sys.fert.unfertilizedIndex, "Paid != owed");
                return;
            }
        }

        // Distribute the rest of the Fertilized Beans
        s.sys.fert.bpf = uint128(newBpf); // SafeCast unnecessary here.
        deltaFertilized += (remainingBpf * s.sys.fert.activeFertilizer);
        s.sys.fert.fertilizedIndex += deltaFertilized;

        // There will be up to activeFertilizer Beans leftover Beans that are not fertilized.
        // These leftovers will be applied on future Fertilizer receipts.
        s.sys.fert.leftoverBeans = amountToFertilize - deltaFertilized;

        // Confirm successful receipt.
        emit Receipt(ShipmentRecipient.BARN, shipmentAmount, abi.encode(""));
    }
}
