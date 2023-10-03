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

    uint256 private constant ONE_PERCENT = 1e18;
    uint256 private constant 99_PERCENT = 99e18;
    uint256 private constant 100_PERCENT = 100e18;
    
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
            if(currentGaugePoints =< ONE_PERCENT) return 0;
            newGaugePoints = currentGaugePoints.sub(ONE_PERCENT);
        } else {
             if(currentGaugePoints >= 99_PERCENT) return 100_PERCENT;
            newGaugePoints = currentGaugePoints.add(ONE_PERCENT);
        }
    }
}
