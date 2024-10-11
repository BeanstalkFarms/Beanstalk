/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

/**
 * @author Brean
 * @title Mock gauge point contract.
 * @notice Contains a valid and invalid gauge point implementation.
 **/
contract MockGaugePoint {
    uint256 public gaugePoints;

    /**
     * @notice Valid implementation.
     */
    function getGaugePoints(
        uint256 currentGaugePoints,
        uint256 percentDepositedBdv,
        uint256 optimalDepositedBdv
    ) public pure returns (uint256) {
        if (percentDepositedBdv > optimalDepositedBdv) {
            return currentGaugePoints / 2;
        } else {
            return currentGaugePoints * 2;
        }
    }

    /**
     * @notice Invalid due to input parameter.
     */
    function invalidGetGaugePoints() external pure returns (uint256) {
        return 100e6;
    }

    /**
     * @notice Invalid due to changing state.
     */
    function invalidGetGaugePoints2(
        uint256 currentGaugePoints,
        uint256 percentDepositedBdv,
        uint256 optimalDepositedBdv
    ) external returns (uint256) {
        gaugePoints = currentGaugePoints;
        return getGaugePoints(currentGaugePoints, percentDepositedBdv, optimalDepositedBdv);
    }
}
