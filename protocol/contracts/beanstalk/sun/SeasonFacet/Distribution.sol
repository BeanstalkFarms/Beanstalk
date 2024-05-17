// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {C} from "contracts/C.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {Receiving} from "contracts/beanstalk/sun/SeasonFacet/Receiving.sol";
import {ShipmentPlan} from "contracts/ecosystem/ShipmentPlanner.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";

/**
 * @title Distribution
 * @author funderbrker
 * @notice Handles shipping of new Bean mints.
 */
contract Distribution is Receiving {
    using SafeCast for uint256;

    /**
     * @notice Emitted during Sunrise when Beans are distributed to the Field, the Silo, and Fertilizer.
     * @param season The Season in which Beans were distributed.
     * @param shipmentRoutes The routes defining where to distribute.
     * @param shipmentAmounts The amount of Beans distributed to each route.
     */
    event Ship(
        uint32 indexed season,
        Storage.ShipmentRoute[] shipmentRoutes,
        uint256[] shipmentAmounts
    );

    /**
     * @notice Emitted when the shipment routes in storage are replaced with a new set of routes.
     * @param newShipmentRoutes New set of ShipmentRoutes.
     */
    event ShipmentRoutesSet(Storage.ShipmentRoute[] newShipmentRoutes);

    //////////////////// REWARD BEANS ////////////////////

    /**
     * @notice Mints and distributes Beans across all active shipping routes.
     * @param beansToShip The total number of Beans to distribute.
     */
    function ship(uint256 beansToShip) internal {
        C.bean().mint(address(this), beansToShip);

        Storage.ShipmentRoute[] memory shipmentRoutes = s.shipmentRoutes;
        ShipmentPlan[] memory shipmentPlans = new ShipmentPlan[](shipmentRoutes.length);
        uint256[] memory shipmentAmounts = new uint256[](shipmentRoutes.length);
        uint256 totalPoints;
        (shipmentPlans, totalPoints) = getShipmentPlans(shipmentRoutes);

        // May need to calculate individual stream rewards multiple times, since
        // they are dependent on each other and each has a cap.
        for (uint256 i; i < shipmentRoutes.length; i++) {
            bool capExceeded;
            // Calculate the amount of rewards to each stream. Ignores cap and plans with 0 points.
            getBeansFromPoints(shipmentAmounts, shipmentPlans, totalPoints, beansToShip);

            // iterate though each stream, checking that the cap is not exceeded.
            for (uint256 j; j < shipmentAmounts.length; j++) {
                // If shipment amount exceeds plan cap, adjust plan and totals before recomputing.
                if (shipmentAmounts[j] > shipmentPlans[j].cap) {
                    shipmentAmounts[j] = shipmentPlans[j].cap;
                    beansToShip -= shipmentPlans[j].cap;
                    totalPoints -= shipmentPlans[j].points;
                    shipmentPlans[j].points = 0;
                    capExceeded = true;
                }
            }
            // If no cap exceeded, amounts are final.
            if (!capExceeded) break;
        }

        // Ship it.
        for (uint256 i; i < shipmentAmounts.length; i++) {
            if (shipmentAmounts[i] == 0) continue;
            // Success is not verified here. Receive functions should be designed to never revert.
            // address(this).call(
            //     abi.encodeWithSelector(
            //         bytes4(keccak256("receive(uint8,uint256,bytes)")),
            //         shipmentRoutes[i].recipient,
            //         shipmentAmounts[i],
            //         shipmentRoutes[i].data
            //     )
            // );
            receiveShipment(
                shipmentRoutes[i].recipient,
                shipmentAmounts[i],
                shipmentRoutes[i].data
            );
        }

        emit Ship(s.season.current, shipmentRoutes, shipmentAmounts);
    }

    /**
     * @notice Determines the amount of Beans to distribute to each shipping route based on points.
     * @dev Does not factor in route cap.
     * @dev If points are 0, does not alter the associated shippingAmount.
     * @dev Assumes shipmentAmounts and shipmentRoutes have matching shape and ordering.
     */
    function getBeansFromPoints(
        uint256[] memory shipmentAmounts,
        ShipmentPlan[] memory shipmentPlans,
        uint256 totalPoints,
        uint256 beansToShip
    ) private pure {
        for (uint256 i; i < shipmentPlans.length; i++) {
            // Do not modify amount for streams with 0 points. They either are zero or have already been set.
            if (shipmentPlans[i].points == 0) continue;
            shipmentAmounts[i] = (beansToShip * shipmentPlans[i].points) / totalPoints; // round down
        }
    }

    function hashShipmentRoute(
        Storage.ShipmentRoute memory shipmentRoute
    ) internal pure returns (bytes32 hash) {
        return
            keccak256(
                abi.encode(
                    shipmentRoute.planContract,
                    shipmentRoute.planSelector,
                    uint8(shipmentRoute.recipient),
                    keccak256(shipmentRoute.data)
                )
            );
    }

    /**
     * @notice Gets the shipping plan for all shipping routes.
     * @dev Determines which routes are active and how many Beans they will receive.
     * @dev GetPlan functions should never fail/revert. Else they will have no Beans allocated.
     */
    function getShipmentPlans(
        Storage.ShipmentRoute[] memory shipmentRoutes
    ) private view returns (ShipmentPlan[] memory shipmentPlans, uint256 totalPoints) {
        shipmentPlans = new ShipmentPlan[](shipmentRoutes.length);
        for (uint256 i; i < shipmentRoutes.length; i++) {
            (bool success, bytes memory returnData) = shipmentRoutes[i].planContract.staticcall(
                abi.encodeWithSelector(shipmentRoutes[i].planSelector, shipmentRoutes[i].data)
            );
            if (success) {
                shipmentPlans[i] = abi.decode(returnData, (ShipmentPlan));
            } else {
                shipmentPlans[i] = ShipmentPlan({points: 0, cap: 0});
            }
            totalPoints += shipmentPlans[i].points;
        }
    }

    /**
     * @notice Replaces the entire set of ShipmentRoutes with a new set.
     * @dev Changes take effect immediately and will be seen at the next sunrise mint.
     */
    function setShipmentRoutes(Storage.ShipmentRoute[] calldata shipmentRoutes) public {
        LibDiamond.enforceIsOwnerOrContract();
        delete s.shipmentRoutes;
        for (uint256 i; i < shipmentRoutes.length; i++) {
            s.shipmentRoutes.push(shipmentRoutes[i]);
        }
        emit ShipmentRoutesSet(shipmentRoutes);
    }
}
