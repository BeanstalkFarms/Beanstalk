/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {Storage} from "contracts/beanstalk/AppStorage.sol";

// NOTE: Values are arbitrary placeholders.

/**
 * @author funderbrker
 * @notice Initializes logistics and shipment routes.
 */
contract InitDistribution {
    AppStorage internal s;

    function init() external {
        s.shipmentRoutes.push(
            Storage.ShipmentRoute(
                address(this),
                bytes4(keccak256("siloReceive(uint256,bytes)")),
                Storage.Recipient.Silo,
                bytes("")
            )
        );

        s.shipmentRoutes.push(
            Storage.ShipmentRoute(
                address(this),
                bytes4(keccak256("fieldReceive(uint256,bytes)")),
                Storage.Recipient.Field,
                bytes("")
            )
        );

        s.shipmentRoutes.push(
            Storage.ShipmentRoute(
                address(this),
                bytes4(keccak256("barnReceive(uint256,bytes)")),
                Storage.Recipient.Barn,
                bytes("")
            )
        );
    }
}
