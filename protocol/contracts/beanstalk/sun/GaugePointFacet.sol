/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title GaugePointFacet
 * @author Brean
 * @notice Calculates the gaugePoints for whitelisted Silo LP tokens.
 * 
 */
contract GaugePointFacet {
    using SafeMath for uint256;

    uint256 private constant ONE_POINT = 1e18;
    uint256 private constant NINE_NINE_POINTS = 99e18;
    uint256 private constant ONE_HUNDRED_POINTS = 100e18;
    
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
        if(percentOfDepositedBdv > optimalPercentDepositedBdv){
            if(currentGaugePoints <= ONE_POINT) return 0;
            newGaugePoints = currentGaugePoints.sub(ONE_POINT);
        } else {
             if(currentGaugePoints >= NINE_NINE_POINTS) return ONE_HUNDRED_POINTS;
            newGaugePoints = currentGaugePoints.add(ONE_PERCENT);
        }
    }
}
