/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";

/**
 * @title GaugePointFacet
 * @author Brean
 * @notice Calculates the gaugePoints for whitelisted Silo LP tokens. additionally hosts the 
 * updateGrownStalkPerBDV function.
 */
contract GaugePointFacet {
    using SafeMath for uint256;

    uint256 private constant ONE_POINT = 1e18;
    
    /**
     * @notice DefaultGaugePointFunction 
     * is the default function to calculate the gauge points
     * of an LP asset.
     */
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints) {
        if (percentOfDepositedBdv > optimalPercentDepositedBdv) {
            newGaugePoints = currentGaugePoints.sub(ONE_POINT);
        } else {
            newGaugePoints = currentGaugePoints.add(ONE_POINT);
        }
    }

    /**
     * @notice updates the updateStalkPerBdvPerSeason in the seed gauge.
     * @dev anyone can call this function to update. Currently, the function
     * updates the targetGrownStalkPerBdvPerSeason such that it will take 6 months
     * for the average new depositer to catch up to the average grown stalk per BDV.
     *
     * The expectation is that actors will call this function on their own as it benefits them.
     * Newer depositers will call it if the value increases to catch up to the average faster,
     * Older depositers will call it if the value decreases to slow down their rate of dilution.
     */
    function updateStalkPerBdvPerSeason() external {
        LibGauge.updateStalkPerBdvPerSeason();
    }
}
