/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTransmitIn} from "contracts/libraries/ForkSystem/LibTransmitIn.sol";

/**
 * @title TransmitInFacet
 * @author funderbrker
 * @notice Destination instance logic for receiving transmitted assets from another version.
 * @notice Destination has knowledge of valid Sources and their configurations at deployment time.
 **/
contract TransmitInFacet is Invariable {
    AppStorage internal s;

    /**
     * @notice Process the inbound migration locally.
     * @dev Reverts if failure to mint assets or handle migration in.
     * @dev Arguments are bytes because different sources may use different encodings.
     */
    function transmitIn(
        address user,
        bytes[][] calldata assets,
        bytes calldata //data
    ) external fundsSafu {
        require(s.sys.supportedSourceForks[msg.sender], "Unsupported source");
        require(assets.length >= 2, "Insufficient data provided");

        LibTransmitIn.transmitInDeposits(user, assets[0]);
        LibTransmitIn.transmitInPlots(user, assets[1]);
        if (assets.length > 2) {
            LibTransmitIn.transmitInFertilizer(user, assets[2]);
        }
        // additional assets can be processed here in the future
    }
}
