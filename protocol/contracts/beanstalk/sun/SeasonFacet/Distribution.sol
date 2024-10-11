// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {ShipmentRoute} from "contracts/beanstalk/storage/System.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";

/**
 * @title Distribution
 * @author funderbrker
 * @notice Handles shipping of new Bean mints.
 */
contract Distribution is ReentrancyGuard {
    using SafeCast for uint256;

    /**
     * @notice Emitted when the shipment routes in storage are replaced with a new set of routes.
     * @param newShipmentRoutes New set of ShipmentRoutes.
     */
    event ShipmentRoutesSet(ShipmentRoute[] newShipmentRoutes);

    //////////////////// REWARD BEANS ////////////////////

    /**
     * @notice Gets the current set of ShipmentRoutes.
     */
    function getShipmentRoutes() external view returns (ShipmentRoute[] memory) {
        return s.sys.shipmentRoutes;
    }

    /**
     * @notice Replaces the entire set of ShipmentRoutes with a new set.
     * @dev Changes take effect immediately and will be seen at the next sunrise mint.
     */
    function setShipmentRoutes(ShipmentRoute[] calldata shipmentRoutes) external {
        LibDiamond.enforceIsOwnerOrContract();
        delete s.sys.shipmentRoutes;
        for (uint256 i; i < shipmentRoutes.length; i++) {
            s.sys.shipmentRoutes.push(shipmentRoutes[i]);
        }
        emit ShipmentRoutesSet(shipmentRoutes);
    }
}
