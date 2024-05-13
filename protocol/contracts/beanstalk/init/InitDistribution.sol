/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {ShipmentPlanner} from "contracts/ecosystem/ShipmentPlanner.sol";

// NOTE: Values are arbitrary placeholders.

/**
 * @author funderbrker
 * @notice Initializes logistics and shipment routes.
 */
contract InitDistribution {
    AppStorage internal s;

    address shipmentPlanner = new ShipmentPlans();

    function init() external {
        ShipmentRoutes[] memory shipmentRoutes = new ShipmentRoutes[](3);

        shipmentRoutes[0] = Storage.ShipmentRoute(
            shipmentPlanner,
            bytes4(keccak256(ShipmentPlanner.siloReceive.selector)),
            Storage.Recipient.Silo,
            bytes("")
        );

        shipmentRoutes[1] = Storage.ShipmentRoute(
            shipmentPlanner,
            bytes4(keccak256(ShipmentPlanner.fieldReceive.selector)),
            Storage.Recipient.Field,
            bytes("")
        );

        shipmentRoutes[2] = Storage.ShipmentRoute(
            shipmentPlanner,
            bytes4(keccak256(ShipmentPlanner.barnReceive.selector)),
            Storage.Recipient.Barn,
            bytes("")
        );

        setShipmentRoutes(shipmentRoutes);
    }
}
