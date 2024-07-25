// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ShipmentPlan, ShipmentPlanner, IBeanstalk} from "contracts/ecosystem/ShipmentPlanner.sol";

/**
 * @title ShipmentPlanner
 * @notice Same as standard Shipment planner, but implements two Fields with different points.
 */
contract ShipmentPlannerFour is ShipmentPlanner {
    uint256 constant FIELD_0_POINTS = FIELD_POINTS / 3; // 111_111_111_111_111_111
    uint256 constant FIELD_1_POINTS = FIELD_POINTS;

    constructor(address beanstalkAddress) ShipmentPlanner(beanstalkAddress) {}

    function getFieldPlanFour(
        bytes memory data
    ) external view returns (ShipmentPlan memory shipmentPlan) {
        uint256 fieldId = abi.decode(data, (uint256));
        require(fieldId < beanstalk.fieldCount(), "Field does not exist");
        if (!beanstalk.isHarvesting(fieldId)) return shipmentPlan;
        uint256 points;
        if (fieldId == 0) points = FIELD_0_POINTS;
        else if (fieldId == 1) points = FIELD_1_POINTS;
        else revert("Field plan does not exist");
        return ShipmentPlan({points: points, cap: beanstalk.totalUnharvestable(fieldId)});
    }
}
