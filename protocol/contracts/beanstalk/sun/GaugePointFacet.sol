/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/C.sol";
import "contracts/libraries/Curve/LibBeanMetaCurve.sol";
import "contracts/libraries/LibUnripe.sol";
import "contracts/libraries/Well/LibWellBdv.sol";

/**
 * @title GaugeFacet
 * @author Brean
 * @notice Calculates the gaugePoints for whitelisted Silo LP tokens.
 * 
 */
contract GaugePointFacet {
    using SafeMath for uint256;
    
    /**
     * @notice DefaultGaugePointFunction 
     * is the default function to calculate the gauge points
     * of an LP asset.
     * @dev this is called if the gaugePoints selector in appStorage
     * is 1 (0 means not enabled).
     */
    function defaultGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv
    ) external pure returns (uint256 newGaugePoints) {
        if(percentOfDepositedBdv > optimalPercentDepositedBdv){
            newGaugePoints = currentGaugePoints.sub(1e6);
        } else {
            newGaugePoints = currentGaugePoints.add(1e6);
        }
    }
}
