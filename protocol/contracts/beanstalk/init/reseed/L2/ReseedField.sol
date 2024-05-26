/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice ReseedField re-initializes the field.
 * @dev plots are re-issued to existing farmers. Field is set to L1 state.
 */
contract ReseedField {
    AppStorage internal s;

    struct Plot {
        uint256 podIndex;
        uint256 podAmounts;
    }
    struct MigratedPlotData {
        address account;
        Plot[] plots;
    }

    // emitted when a plot is migrated.
    event MigratedPlot(address indexed account, uint256 indexed plotIndex, uint256 pods);

    /**
     * @notice Re-initializes the field.
     * @param accountPlots the plots for each account
     * @param totalPods The total number of pods on L1.
     * @param harvestable The number of harvestable pods on L1.
     * @param harvested The number of harvested pods on L1.
     */
    function init(
        MigratedPlotData[] calldata accountPlots,
        uint256 totalPods,
        uint256 harvestable,
        uint256 harvested
    ) external {
        uint256 calculatedTotalPods;
        for (uint i; i < accountPlots.length; i++) {
            for (uint j; j < accountPlots[i].plots.length; i++) {
                uint256 podIndex = accountPlots[i].plots[j].podIndex;
                uint256 podAmount = accountPlots[i].plots[j].podAmounts;
                s.a[accountPlots[i].account].field.plots[podIndex] = podAmount;
                s.a[accountPlots[i].account].field.plotIndexes.push(podIndex);
                emit MigratedPlot(accountPlots[i].account, podIndex, podAmount);
                calculatedTotalPods += podAmount;
            }
        }

        //  perform verfication:
        require(calculatedTotalPods == totalPods, "ReseedField: totalPods mismatch");
        require(totalPods >= harvestable, "ReseedField: harvestable mismatch");
        require(harvestable >= harvested, "ReseedField: harvested mismatch");

        s.f.pods = totalPods;
        s.f.harvestable = harvestable;
        s.f.harvested = harvested;
    }
}