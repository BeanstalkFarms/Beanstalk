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

    uint256 BEAN_ETH_PERCENT_UPPER_BOUND = 0.75e18; // 75%
    uint256 BEAN_ETH_PERCENT_OPTIMAL = 0.5e18; // 50%
    uint256 BEAN_ETH_PERCENT_LOWER_BOUND = 0.25e18; // 25%

    /**
     * @notice calculates the BeanEth Gauge Points.
     */
    function beanEthGaugePoints(
        uint256 currentGaugePoints,
        uint256 percentOfDepositedBdv
    ) external view returns (uint256) {
        if (percentOfDepositedBdv <= BEAN_ETH_PERCENT_UPPER_BOUND) {
            return currentGaugePoints.mul(99).div(100).sub(1e6);
        } else if (percentOfDepositedBdv <= BEAN_ETH_PERCENT_OPTIMAL) {
            return currentGaugePoints.sub(1e6);
        } else if (percentOfDepositedBdv <= BEAN_ETH_PERCENT_LOWER_BOUND) {
            return currentGaugePoints.add(1e6);
        } else {
            return currentGaugePoints.mul(101).div(100).add(1e6);
        }
    }

    /**
     * @notice calculates the urBeanEth Gauge Points.
     */
    function urBeanEthGaugePoints(
        uint256 ,
        uint256 
    ) external pure returns (uint256) {
        return 0;
    }

    /**
     * @notice calculates the bean3Crv Gauge Points.
     */
    function bean3CrvGaugePoints(
        uint256,
        uint256 
    ) external pure returns (uint256) {
        return 0;
    }
}
