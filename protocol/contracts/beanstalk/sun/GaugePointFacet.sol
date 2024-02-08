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
    using SafeMath for uint256;

    uint256 private constant ONE_POINT = 1e18;

    /**
     * @notice DefaultGaugePointFunction
     * is the default function to calculate the gauge points
     * of an LP asset.
     * 
     * @dev if % of deposited BDV is .01% within range of optimal,
     * keep gauge points the same.
     */
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints) {
        if (percentOfDepositedBdv > optimalPercentDepositedBdv.mul(10001).div(10000)) {
            // gauge points cannot go below 0.
            if (currentGaugePoints <= ONE_POINT) return 0;
            newGaugePoints = currentGaugePoints.sub(ONE_POINT);
        } else if (percentOfDepositedBdv < optimalPercentDepositedBdv.mul(9999).div(10000)) {
            newGaugePoints = currentGaugePoints.add(ONE_POINT);
        }
    }
}
