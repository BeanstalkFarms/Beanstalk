/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

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
            (optimalPercentDepositedBdv * UPPER_THRESHOLD) / THRESHOLD_PRECISION
        ) {
            // gauge points cannot go below 0.
            if (currentGaugePoints <= ONE_POINT) return 0;
            newGaugePoints = currentGaugePoints - ONE_POINT;
        } else if (
            percentOfDepositedBdv <
            (optimalPercentDepositedBdv * LOWER_THRESHOLD) / THRESHOLD_PRECISION
        ) {
            newGaugePoints = currentGaugePoints + ONE_POINT;

            // Cap gaugePoints to MAX_GAUGE_POINTS if it exceeds.
            if (newGaugePoints > MAX_GAUGE_POINTS) return MAX_GAUGE_POINTS;
        }
    }
}
