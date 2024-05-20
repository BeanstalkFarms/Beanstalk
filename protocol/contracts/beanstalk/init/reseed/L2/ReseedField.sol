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

    // emitted when a plot is migrated.
    event MigratedPlot(address indexed account, uint256 indexed plotIndex, uint256 pods);

    /**
     * @notice Re-initializes the field.
     * @param accounts The addresses of the farmers.
     * @param podIndex The index of the pods.
     * @param podAmounts The amounts of the pods.
     * @param totalPods The total number of pods on L1.
     * @param harvestable The number of harvestable pods on L1.
     * @param harvested The number of harvested pods on L1.
     */
    function init(
        address[] calldata accounts,
        uint256[][] calldata podIndex,
        uint256[][] calldata podAmounts,
        uint256 totalPods,
        uint256 harvestable,
        uint256 harvested
    ) external {
        uint256 calculatedTotalPods;
        for (uint i; i < accounts.length; i++) {
            for (uint j; j < podIndex.length; i++) {
                s.a[accounts[i]].field.plots[podIndex[i][j]] = podAmounts[i][j];
                s.a[accounts[i]].field.plotIndexes.push(podIndex[i][j]);

                emit MigratedPlot(accounts[i], podIndex[i][j], podAmounts[i][j]);
                calculatedTotalPods += podAmounts[i][j];
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
