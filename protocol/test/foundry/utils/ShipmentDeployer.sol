/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {IMockFBeanstalk as IBS} from "contracts/interfaces/IMockFBeanstalk.sol";
import {Utils, console} from "test/foundry/utils/Utils.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {C} from "contracts/C.sol";
import {ShipmentPlanner} from "contracts/ecosystem/ShipmentPlanner.sol";
import {IShipmentPlanner} from "contracts/interfaces/IShipmentPlanner.sol";

/**
 * @title ShipmentDeployer
 * @author funderbrker
 * @notice Test helper contract to deploy ShipmentPlanner and set Routes.
 */
contract ShipmentDeployer is Utils {
    address shipmentPlanner;

    function initShipping(bool verbose) internal {
        bs = IBS(BEANSTALK);

        // Create Field, set active, and initialize Temperature.
        vm.prank(deployer);
        bs.addField();
        vm.prank(deployer);
        bs.setActiveField(0, 1);

        // Deploy the planner, which will determine points and caps of each route.
        shipmentPlanner = address(new ShipmentPlanner(BEANSTALK));

        // Set up three routes: the Silo, Barn, and a Field.
        setRoutes_siloAndBarnAndFields();

        if (verbose) console.log("ShipmentPlanner deployed at: ", shipmentPlanner);
    }

    /**
     * @notice Set the shipment routes to only the Silo. It will receive 100% of Mints.
     */
    function setRoutes_silo() internal {
        IBS.ShipmentRoute[] memory shipmentRoutes = new IBS.ShipmentRoute[](1);
        shipmentRoutes[0] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getSiloPlan.selector,
            recipient: IBS.ShipmentRecipient.SILO,
            data: abi.encodePacked("")
        });
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }

    /**
     * @notice Set the shipment routes to the Silo and Barn. Each wil receive 50% of Mints.
     */
    function setRoutes_siloAndBarn() internal {
        IBS.ShipmentRoute[] memory shipmentRoutes = new IBS.ShipmentRoute[](2);
        shipmentRoutes[0] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getSiloPlan.selector,
            recipient: IBS.ShipmentRecipient.SILO,
            data: abi.encodePacked("")
        });
        shipmentRoutes[1] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getBarnPlan.selector,
            recipient: IBS.ShipmentRecipient.BARN,
            data: abi.encodePacked("")
        });
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }

    function setRoutes_siloAndFields() internal {
        uint256 fieldCount = IBS(BEANSTALK).fieldCount();
        IBS.ShipmentRoute[] memory shipmentRoutes = new IBS.ShipmentRoute[](1 + fieldCount);
        shipmentRoutes[0] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getSiloPlan.selector,
            recipient: IBS.ShipmentRecipient.SILO,
            data: abi.encodePacked("")
        });
        for (uint256 i = 0; i < fieldCount; i++) {
            shipmentRoutes[i + 1] = IBS.ShipmentRoute({
                planContract: shipmentPlanner,
                planSelector: IShipmentPlanner.getFieldPlan.selector,
                recipient: IBS.ShipmentRecipient.FIELD,
                data: abi.encodePacked(i)
            });
        }
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }

    /**
     * @notice Set the shipment routes to the Silo, Barn, and N Fields. Each will receive 1/(N+2) of Mints.
     * @dev Need to add Fields before calling.
     */
    function setRoutes_siloAndBarnAndFields() internal {
        uint256 fieldCount = IBS(BEANSTALK).fieldCount();
        IBS.ShipmentRoute[] memory shipmentRoutes = new IBS.ShipmentRoute[](2 + fieldCount);
        shipmentRoutes[0] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getSiloPlan.selector,
            recipient: IBS.ShipmentRecipient.SILO,
            data: abi.encodePacked("")
        });
        shipmentRoutes[1] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getBarnPlan.selector,
            recipient: IBS.ShipmentRecipient.BARN,
            data: abi.encodePacked("")
        });
        for (uint256 i = 0; i < fieldCount; i++) {
            shipmentRoutes[i + 2] = IBS.ShipmentRoute({
                planContract: shipmentPlanner,
                planSelector: IShipmentPlanner.getFieldPlan.selector,
                recipient: IBS.ShipmentRecipient.FIELD,
                data: abi.encodePacked(i)
            });
        }
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }
}
