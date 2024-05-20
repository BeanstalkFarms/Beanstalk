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

    function addField() external;

    function setActiveField(uint256 fieldId) external;
}

/**
 * @author funderbrker
 * @notice Initializes logistics and shipment routes.
 */
contract InitDistribution {
    // address constant BEANSTALK = 0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5;

    AppStorage internal s;
    IBeanstalk beanstalk;

    function init(address shipmentPlanner) external {
        beanstalk = IBeanstalk(address(this));
        require(
            shipmentPlanner != address(0),
            "InitDistribution: ShipmentPlanner deployment failed."
        );
        Storage.ShipmentRoute[] memory shipmentRoutes = new Storage.ShipmentRoute[](3);

        shipmentRoutes[0] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getSiloPlan.selector,
            Storage.ShipmentRecipient.Silo,
            bytes("")
        );

        shipmentRoutes[1] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getFieldPlan.selector,
            Storage.ShipmentRecipient.Field,
            abi.encode(uint256(0))
        );

        shipmentRoutes[2] = Storage.ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getBarnPlan.selector,
            Storage.ShipmentRecipient.Barn,
            bytes("")
        );

        beanstalk.setShipmentRoutes(shipmentRoutes);
        beanstalk.addField();
        beanstalk.setActiveField(0);

        // TODO: Initialize Field values from priors.
    }
}
