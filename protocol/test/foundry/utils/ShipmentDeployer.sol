/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {IMockFBeanstalk as IBS} from "contracts/interfaces/IMockFBeanstalk.sol";
import {Utils, console} from "test/foundry/utils/Utils.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {C} from "contracts/C.sol";
import {ShipmentPlanner, ShipmentPlan} from "contracts/ecosystem/ShipmentPlanner.sol";
import {IShipmentPlanner} from "contracts/interfaces/IShipmentPlanner.sol";
import {ShipmentPlannerFour} from "test/foundry/utils/ShipmentPlannerFour.sol";

// Extend the interface to support Fields with different points.
interface IShipmentPlannerFour is IShipmentPlanner {
    function getFieldPlanFour(bytes memory data) external view returns (ShipmentPlan memory);
}

/**
 * @title ShipmentDeployer
 * @author funderbrker
 * @notice Test helper contract to deploy ShipmentPlanner and set Routes.
 */
contract ShipmentDeployer is Utils {
    address shipmentPlanner;
    address shipmentPlannerFour;

    function initShipping(bool verbose) internal {
        // Create two Fields, set active, and initialize Temperature.
        // vm.prank(deployer);
        // bs.addField();
        vm.prank(deployer);
        bs.addField();
        vm.prank(deployer);
        bs.setActiveField(0, 1);

        // Deploy the planner, which will determine points and caps of each route.
        shipmentPlanner = address(new ShipmentPlanner(address(bs)));
        shipmentPlannerFour = address(new ShipmentPlannerFour(address(bs)));

        // Set up three routes: the Silo, Barn, and a Field.
        setRoutes_siloAndBarnAndField();

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
        uint256 fieldCount = IBS(address(bs)).fieldCount();
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
     * @notice Set the shipment routes to the Silo, Barn, and 1 Field. Each will receive 1/3 of Mints.
     * @dev Need to add Fields before calling.
     */
    function setRoutes_siloAndBarnAndField() internal {
        uint256 fieldCount = IBS(address(bs)).fieldCount();
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
        shipmentRoutes[2] = IBS.ShipmentRoute({
            planContract: shipmentPlanner,
            planSelector: IShipmentPlanner.getFieldPlan.selector,
            recipient: IBS.ShipmentRecipient.FIELD,
            data: abi.encodePacked(uint256(0))
        });
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }

    /**
     * @notice Set the shipment routes to the Silo, Barn, one active Field, and one reduced Field.
     *         Mints are split 3/3/3/1, respectively.
     * @dev Need to add Fields before calling.
     */
    function setRoutes_siloAndBarnAndTwoFields() internal {
        uint256 fieldCount = IBS(address(bs)).fieldCount();
        require(fieldCount == 2, "Must have 2 Fields to set routes");
        IBS.ShipmentRoute[] memory shipmentRoutes = new IBS.ShipmentRoute[](2 + fieldCount);
        shipmentRoutes[0] = IBS.ShipmentRoute({
            planContract: shipmentPlannerFour,
            planSelector: IShipmentPlanner.getSiloPlan.selector,
            recipient: IBS.ShipmentRecipient.SILO,
            data: abi.encodePacked("")
        });
        shipmentRoutes[1] = IBS.ShipmentRoute({
            planContract: shipmentPlannerFour,
            planSelector: IShipmentPlanner.getBarnPlan.selector,
            recipient: IBS.ShipmentRecipient.BARN,
            data: abi.encodePacked("")
        });
        shipmentRoutes[2] = IBS.ShipmentRoute({
            planContract: shipmentPlannerFour,
            planSelector: IShipmentPlannerFour.getFieldPlanFour.selector,
            recipient: IBS.ShipmentRecipient.FIELD,
            data: abi.encodePacked(uint256(0))
        });
        shipmentRoutes[3] = IBS.ShipmentRoute({
            planContract: shipmentPlannerFour,
            planSelector: IShipmentPlannerFour.getFieldPlanFour.selector,
            recipient: IBS.ShipmentRecipient.FIELD,
            data: abi.encodePacked(uint256(1))
        });
        vm.prank(deployer);
        bs.setShipmentRoutes(shipmentRoutes);
    }
}
