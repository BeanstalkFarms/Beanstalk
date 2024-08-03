/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean, Deadmanwalking
 * @notice ReseedField re-initializes the Field.
 * @dev Plots are re-issued to existing farmers. Field is set to L1 state.
 */
contract ReseedField {
    AppStorage internal s;

    struct Plot {
        uint256 podIndex;
        uint256 podAmounts;
    }
    struct MigratedPlotData {
        address account;
        uint256 fieldId;
        Plot[] plots;
    }

    // emitted when a plot is migrated.
    event MigratedPlot(address indexed account, uint256 indexed plotIndex, uint256 pods);

    /**
     * @notice Re-initializes the field.
     * @param accountPlots the plots for each account
     * @dev Receives an array of plots for each account and initializes them. 
     * On migration, we just split the array to stay under gas limits.
     */
    function init(
        MigratedPlotData[] calldata accountPlots
    ) external {
        for (uint i; i < accountPlots.length; i++) {
            for (uint j; j < accountPlots[i].plots.length; j++) {
                uint256 podIndex = accountPlots[i].plots[j].podIndex;
                uint256 podAmount = accountPlots[i].plots[j].podAmounts;
                s.accts[accountPlots[i].account].fields[accountPlots[i].fieldId].plots[podIndex] = podAmount;
                s.accts[accountPlots[i].account].fields[accountPlots[i].fieldId].plotIndexes.push(podIndex);
                emit MigratedPlot(accountPlots[i].account, podIndex, podAmount);
            }
        }
    }
}
