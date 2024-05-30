/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";

/**
 * @title GaugePointFacet
 * @author Brean
 * @notice Calculates the gaugePoints for whitelisted Silo LP tokens.
 */
interface IGaugePointFacet {
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints);
}

contract GaugePointFacet {
    using LibRedundantMath256 for uint256;

    uint256 private constant ONE_POINT = 1e18;
    uint256 private constant MAX_GAUGE_POINTS = 1000e18;

    uint256 private constant UPPER_THRESHOLD = 10001;
    uint256 private constant LOWER_THRESHOLD = 9999;
    uint256 private constant THRESHOLD_PRECISION = 10000;

    /**
     * @notice DefaultGaugePointFunction
     * is the default function to calculate the gauge points
     * of an LP asset.
     *
     * @dev If % of deposited BDV is .01% within range of optimal,
     * keep gauge points the same.
     *
     * Cap gaugePoints to MAX_GAUGE_POINTS to avoid runaway gaugePoints.
     */
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints) {
        if (
            percentOfDepositedBdv >
            optimalPercentDepositedBdv.mul(UPPER_THRESHOLD).div(THRESHOLD_PRECISION)
        ) {
            // gauge points cannot go below 0.
            if (currentGaugePoints <= ONE_POINT) return 0;
            newGaugePoints = currentGaugePoints.sub(ONE_POINT);
        } else if (
            percentOfDepositedBdv <
            optimalPercentDepositedBdv.mul(LOWER_THRESHOLD).div(THRESHOLD_PRECISION)
        ) {
            newGaugePoints = currentGaugePoints.add(ONE_POINT);

            // Cap gaugePoints to MAX_GAUGE_POINTS if it exceeds.
            if (newGaugePoints > MAX_GAUGE_POINTS) return MAX_GAUGE_POINTS;
        } else {
            // If % of deposited BDV is .01% within range of optimal, 
            // keep gauge points the same.
            return currentGaugePoints;
        }
    }
}
