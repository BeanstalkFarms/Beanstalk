// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {LibFertilizer} from "contracts/libraries/LibFertilizer.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";

/**
 * @title Receiving
 * @author funderbrker
 * @notice Holds the functions responsible for receiving Bean shipments after mints. These
 *  functions must live inside of the Beanstalk Diamond. If new receiving components are needed,
 *  this contract and its containing Facet will need to be updated.
 * @dev An alternative design could remove the need for the generalized receive() entry function
 *  and instead require the shipping route to define the selector of its own corresponding receive
 *  function. However, both designs will require a Facet cut if a new receive function is needed,
 *  so this design was chosen for additional clarity.
 */
contract Receiving is ReentrancyGuard {
    using SafeCast for uint256;

    /**
     * @notice General entry point to receive Beans at a given component of the system.
     * @dev Receive functions should be designed to never revert.
     * @param recipient The Beanstalk component that will receive the Beans.
     * @param amount The amount of Beans to receive.
     * @param data Additional data to pass to the receiving function.
     */
    function receiveShipment(
        Storage.ShipmentRecipient recipient,
        uint256 amount,
        bytes memory data
    ) internal {
        if (recipient == Storage.ShipmentRecipient.Silo) {
            siloReceive(amount, data);
        } else if (recipient == Storage.ShipmentRecipient.Field) {
            fieldReceive(amount, data);
        } else if (recipient == Storage.ShipmentRecipient.Barn) {
            barnReceive(amount, data);
        }
        // New receiveShipment enum values should have a corresponding function call here.
    }

    /**
     * @notice Receive Beans at the Silo, distributing Stalk & Earned Beans.
     * @dev Data param not used.
     * @param amount Amount of Beans to receive.
     */
    function siloReceive(uint256 amount, bytes memory) private {
        // `s.earnedBeans` is an accounting mechanism that tracks the total number
        // of Earned Beans that are claimable by Stalkholders. When claimed via `plant()`,
        // it is decremented. See {Silo.sol:_plant} for more details.
        s.earnedBeans = s.earnedBeans + amount.toUint128();

        // Mint Stalk (as Earned Stalk).
        // Stalk is created here because only Beans that are allocated to the Silo receive Stalk.
        s.silo.stalk = s.silo.stalk + (amount * C.STALK_PER_BEAN);

        // SafeCast unnecessary here because of prior safe cast.
        s.siloBalances[C.BEAN].deposited = s.siloBalances[C.BEAN].deposited + uint128(amount);
        s.siloBalances[C.BEAN].depositedBdv = s.siloBalances[C.BEAN].depositedBdv + uint128(amount);
    }

    /**
     * @notice Receive Beans at the Field. The next `amount` Pods become harvestable.
     * @dev Amount should never exceed the number of Pods that are not yet Harvestable.
     * @param amount Amount of Beans to receive.
     * @param data Encoded uint256 containing the index of the Field to receive the Beans.
     */
    function fieldReceive(uint256 amount, bytes memory data) private {
        uint256 fieldId = abi.decode(data, (uint256));
        require(fieldId < s.fieldCount, "Field does not exist");
        s.fields[fieldId].harvestable += amount;
    }

    /**
     * @notice Receive Beans at the Barn. Amount of Sprouts become Rinsible.
     * @dev Data param not used.
     * @param amount Amount of Beans to receive.
     */
    function barnReceive(uint256 amount, bytes memory) private {
        uint256 deltaFertilized;

        // Get the new Beans per Fertilizer and the total new Beans per Fertilizer
        uint256 remainingBpf = amount / s.activeFertilizer;
        uint256 oldBpf = s.bpf;
        uint256 newBpf = oldBpf + remainingBpf;

        // Get the end BPF of the first Fertilizer to run out.
        uint256 firstBpf = s.fertFirst;

        // If the next fertilizer is going to run out, then step BPF according
        while (newBpf >= firstBpf) {
            // Increment the cumulative change in Fertilized.
            deltaFertilized += (firstBpf - oldBpf) * s.activeFertilizer; // fertilizer between init and next cliff

            if (LibFertilizer.pop()) {
                oldBpf = firstBpf;
                firstBpf = s.fertFirst;
                // Calculate BPF beyond the first Fertilizer edge.
                remainingBpf = (amount - deltaFertilized) / s.activeFertilizer;
                newBpf = oldBpf + remainingBpf;
            }
            // Else, if there is no more fertilizer. Matches plan cap.
            else {
                s.bpf = uint128(firstBpf); // SafeCast unnecessary here.
                s.fertilizedIndex = s.fertilizedIndex + deltaFertilized;
                require(amount == deltaFertilized, "Inexact amount of Beans at Barn");
                require(s.fertilizedIndex == s.unfertilizedIndex, "Paid != owed");
                return;
            }
        }

        // Distribute the rest of the Fertilized Beans
        s.bpf = uint128(newBpf); // SafeCast unnecessary here.
        deltaFertilized = deltaFertilized + (remainingBpf * s.activeFertilizer);
        s.fertilizedIndex = s.fertilizedIndex + deltaFertilized;
    }
}
