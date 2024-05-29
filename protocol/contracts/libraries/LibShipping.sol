// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibReceiving} from "contracts/libraries/LibReceiving.sol";
import {ShipmentRecipient, ShipmentRoute} from "contracts/beanstalk/storage/System.sol";
import {ShipmentPlan} from "contracts/ecosystem/ShipmentPlanner.sol";

/**
 * @title LibShipping
 * @author funderbrker
 * @notice Library for shipments logic.
 * @dev Functions are marked public to reduce the size of SeasonFacet contract.
 */
library LibShipping {
    /**
     * @notice Emitted during Sunrise when Beans mints are shipped through active routes.
     * @param season The Season in which Beans were distributed.
     * @param shipmentAmount The amount of Beans across all routes.
     */
    event Shipped(uint32 indexed season, uint256 shipmentAmount);

    /**
     * @notice Distributes Beans across all active shipping routes.
     * @param beansToShip The total number of Beans to distribute.
     */
    function ship(uint256 beansToShip) public {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 remainingBeansToShip = beansToShip;
        ShipmentRoute[] memory shipmentRoutes = s.sys.shipmentRoutes;
        ShipmentPlan[] memory shipmentPlans = new ShipmentPlan[](shipmentRoutes.length);
        uint256[] memory shipmentAmounts = new uint256[](shipmentRoutes.length);
        uint256 totalPoints;
        (shipmentPlans, totalPoints) = getShipmentPlans(shipmentRoutes);

        // May need to calculate individual stream rewards multiple times, since
        // they are dependent on each others caps. Once a cap is reached, excess Beans are
        // spread to other streams, proportional to their points.
        for (uint256 i; i < shipmentRoutes.length; i++) {
            bool capExceeded;

            // Calculate the amount of rewards to each stream. Ignores cap and plans with 0 points.
            getBeansFromPoints(
                shipmentAmounts,
                shipmentPlans,
                totalPoints,
                remainingBeansToShip
            );

            // Iterate though each stream, checking if cap is exceeded.
            for (uint256 j; j < shipmentAmounts.length; j++) {
                // If shipment amount exceeds plan cap, adjust plan and totals before recomputing.
                if (shipmentAmounts[j] > shipmentPlans[j].cap) {
                    shipmentAmounts[j] = shipmentPlans[j].cap;
                    remainingBeansToShip -= shipmentPlans[j].cap;
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
            LibReceiving.receiveShipment(
                shipmentRoutes[i].recipient,
                shipmentAmounts[i],
                shipmentRoutes[i].data
            );
        }

        emit Shipped(s.sys.season.current, beansToShip);
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
    ) public pure {
        for (uint256 i; i < shipmentPlans.length; i++) {
            // Do not modify amount for streams with 0 points. They either are zero or have already been set.
            if (shipmentPlans[i].points == 0) continue;
            shipmentAmounts[i] = (beansToShip * shipmentPlans[i].points) / totalPoints; // round down
        }
    }

    /**
     * @notice Gets the shipping plan for all shipping routes.
     * @dev Determines which routes are active and how many Beans they will receive.
     * @dev GetPlan functions should never fail/revert. Else they will have no Beans allocated.
     */
    function getShipmentPlans(
        ShipmentRoute[] memory shipmentRoutes
    ) public view returns (ShipmentPlan[] memory shipmentPlans, uint256 totalPoints) {
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
}
