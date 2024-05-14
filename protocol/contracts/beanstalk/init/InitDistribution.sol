/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {ShipmentPlanner} from "contracts/ecosystem/ShipmentPlanner.sol";

// NOTE: Values are arbitrary placeholders.

interface IBeanstalk {
    function setShipmentRoutes(Storage.ShipmentRoute[] calldata shipmentRoutes) external;
}

/**
 * @author funderbrker
 * @notice Initializes logistics and shipment routes.
 */
contract InitDistribution {
    address constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;

    AppStorage internal s;
    IBeanstalk beanstalk = IBeanstalk(BEANSTALK);

    address shipmentPlanner = address(new ShipmentPlanner());

    function init() external {
        Storage.ShipmentRoute[] memory shipmentRoutes = new Storage.ShipmentRoute[](3);

        shipmentRoutes[0] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getSiloPlan.selector,
            Storage.Recipient.Silo,
            bytes("")
        );

        shipmentRoutes[1] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getFieldPlan.selector,
            Storage.Recipient.Field,
            bytes("")
        );

        shipmentRoutes[2] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getBarnPlan.selector,
            Storage.Recipient.Barn,
            bytes("")
        );

        (bool success, ) = BEANSTALK.delegatecall(abi.encodeWithSelector(beanstalk.setShipmentRoutes.selector, shipmentRoutes));
        require(success, "InitDistribution: Failed to set shipment routes.");
    }
}
