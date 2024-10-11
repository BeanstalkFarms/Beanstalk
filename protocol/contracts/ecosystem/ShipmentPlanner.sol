// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @notice Constraints of how many Beans to send to a given route at the current time.
 * @param points Weight of this shipment route relative to all routes. Expects precision of 1e18.
 * @param cap Maximum Beans that can be received by this stream at this time.
 */
struct ShipmentPlan {
    uint256 points;
    uint256 cap;
}

interface IBeanstalk {
    function isFertilizing() external view returns (bool);

    function totalUnfertilizedBeans() external view returns (uint256);

    function leftoverBeans() external view returns (uint256);

    function isHarvesting(uint256 fieldId) external view returns (bool);

    function totalUnharvestable(uint256 fieldId) external view returns (uint256);

    function fieldCount() external view returns (uint256);
}

/**
 * @title ShipmentPlanner
 * @notice Contains getters for retrieving ShipmentPlans for various Beanstalk components.
 * @dev Lives as a standalone immutable contract. Updating shipment plans requires deploying
 * a new instance and updating the ShipmentRoute planContract addresses help in AppStorage.
 * @dev Called via staticcall. New plan getters must be view/pure functions.
 */
contract ShipmentPlanner {
    uint256 constant BARN_POINTS = 333_333_333_333_333_333;
    uint256 constant FIELD_POINTS = 333_333_333_333_333_333;
    uint256 constant SILO_POINTS = 333_333_333_333_333_333;

    IBeanstalk beanstalk;

    constructor(address beanstalkAddress) {
        beanstalk = IBeanstalk(beanstalkAddress);
    }

    /**
     * @notice Get the current points and cap for Barn shipments.
     * @dev The Barn cap is the amount of outstanding unfertilized fertilizer.
     * @dev data param is unused data to configure plan details.
     */
    function getBarnPlan(bytes memory) external view returns (ShipmentPlan memory shipmentPlan) {
        if (!beanstalk.isFertilizing()) return shipmentPlan;
        return
            ShipmentPlan({
                points: BARN_POINTS,
                cap: beanstalk.totalUnfertilizedBeans() - beanstalk.leftoverBeans()
            });
    }

    /**
     * @notice Get the current points and cap for Field shipments.
     * @dev The Field cap is the amount of outstanding Pods unharvestable pods.
     * @param data Encoded uint256 containing the index of the Field to receive the Beans.
     */
    function getFieldPlan(
        bytes memory data
    ) external view returns (ShipmentPlan memory shipmentPlan) {
        uint256 fieldId = abi.decode(data, (uint256));
        require(fieldId < beanstalk.fieldCount(), "Field does not exist");
        if (!beanstalk.isHarvesting(fieldId)) return shipmentPlan;
        return ShipmentPlan({points: FIELD_POINTS, cap: beanstalk.totalUnharvestable(fieldId)});
    }

    /**
     * @notice Get the current points and cap for Silo shipments.
     * @dev The Silo has no cap.
     * @dev data param is unused data to configure plan details.
     */
    function getSiloPlan(bytes memory) external pure returns (ShipmentPlan memory shipmentPlan) {
        return ShipmentPlan({points: SILO_POINTS, cap: type(uint256).max});
    }
}
