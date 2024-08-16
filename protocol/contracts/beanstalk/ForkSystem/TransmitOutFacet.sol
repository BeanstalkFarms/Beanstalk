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
     */
    function transmitOut(
        address destination,
        LibTransmitOut.SourceDeposit[] calldata sourceDeposits,
        LibTransmitOut.SourcePlot[] calldata sourcePlots,
        LibTransmitOut.SourceFertilizer[] calldata sourceFertilizer,
        bytes calldata // data
    ) external fundsSafu {
        bytes[] memory deposits = LibTransmitOut.transmitOutDeposits(
            LibTractor._user(),
            destination,
            sourceDeposits
        );
        bytes[] memory plots = LibTransmitOut.transmitOutPlots(LibTractor._user(), sourcePlots);
        bytes[] memory fertilizer = LibTransmitOut.transmitOutFertilizer(
            LibTractor._user(),
            sourceFertilizer
        );

        // Reverts if Destination fails to handle transmitted assets.
        ITransmitInFacet(destination).transmitIn(
            LibTractor._user(),
            deposits,
            plots,
            fertilizer,
            abi.encode("")
        );
    }
}
