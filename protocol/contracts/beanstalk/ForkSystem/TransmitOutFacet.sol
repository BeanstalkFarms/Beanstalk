/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibTransmitOut} from "contracts/libraries/ForkSystem/LibTransmitOut.sol";
import {ITransmitInFacet} from "contracts/interfaces/ITransmitInFacet.sol";

/**
 * @title TransmitOutFacet
 * @author funderbrker
 * @notice Source instance logic for migrating assets to new version.
 * @notice Source instance has no knowledge of possible Destinations or their configurations.
 **/
contract TransmitOutFacet is Invariable {
    /**
     * @notice Process the outbound migration and transfer necessary assets to destination.
     * @dev Reverts if failure to burn assets or destination fails.
     * @param assets Contains abi encoded deposits, plots, and fertilizer.
     * @param data Currently unused but remains available for paramaters such as minimum output requirements.
     */
    function transmitOut(
        address destination,
        bytes[] calldata assets,
        bytes calldata data
    ) external fundsSafu {
        require(assets.length >= 3, "Missing asset data");

        bytes[] memory deposits = LibTransmitOut.transmitOutDeposits(
            LibTractor._user(),
            destination,
            abi.decode(assets[0], (LibTransmitOut.SourceDeposit[]))
        );
        bytes[] memory plots = LibTransmitOut.transmitOutPlots(
            LibTractor._user(),
            abi.decode(assets[1], (LibTransmitOut.SourcePlot[]))
        );
        bytes[] memory fertilizer = LibTransmitOut.transmitOutFertilizer(
            LibTractor._user(),
            abi.decode(assets[2], (LibTransmitOut.SourceFertilizer[]))
        );

        bytes[][] memory processedAssets = new bytes[][](3);
        processedAssets[0] = deposits;
        processedAssets[1] = plots;
        processedAssets[2] = fertilizer;

        // Reverts if Destination fails to handle transmitted assets.
        ITransmitInFacet(destination).transmitIn(LibTractor._user(), processedAssets, data);
    }
}
