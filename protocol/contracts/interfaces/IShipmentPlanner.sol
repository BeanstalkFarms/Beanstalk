// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ShipmentPlan} from "contracts/ecosystem/ShipmentPlanner.sol";

interface IShipmentPlanner {
    function getBarnPlan(bytes memory) external view returns (ShipmentPlan memory shipmentPlan);

    function getFieldPlan(
        bytes memory data
    ) external view returns (ShipmentPlan memory shipmentPlan);

    function getSiloPlan(bytes memory) external pure returns (ShipmentPlan memory shipmentPlan);
}
