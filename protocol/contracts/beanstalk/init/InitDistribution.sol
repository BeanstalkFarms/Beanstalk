/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {ShipmentRoute, ShipmentRecipient} from "contracts/beanstalk/storage/System.sol";
import {ShipmentPlanner} from "contracts/ecosystem/ShipmentPlanner.sol";

// NOTE: Values are arbitrary placeholders.

interface IBeanstalk {
    function setShipmentRoutes(ShipmentRoute[] calldata shipmentRoutes) external;

    function addField() external;

    function setActiveField(uint256 fieldId, uint32 temperature) external;
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
        ShipmentRoute[] memory shipmentRoutes = new ShipmentRoute[](3);

        shipmentRoutes[0] = ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getSiloPlan.selector,
            ShipmentRecipient.SILO,
            bytes("")
        );

        shipmentRoutes[1] = ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getFieldPlan.selector,
            ShipmentRecipient.FIELD,
            abi.encode(uint256(0))
        );

        shipmentRoutes[2] = ShipmentRoute(
            shipmentPlanner,
            ShipmentPlanner.getBarnPlan.selector,
            ShipmentRecipient.BARN,
            bytes("")
        );

        beanstalk.setShipmentRoutes(shipmentRoutes);
        beanstalk.addField();
        beanstalk.setActiveField(0, 1);

        // TODO: Initialize Field values from priors.
    }
}
