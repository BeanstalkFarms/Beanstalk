/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;

import {GaugePointFacet} from "./GaugePointFacet.sol";

/**
 * @title GaugePointPrice
 * @author Brean
 * @notice GaugePointPrice implements `priceGaugePointFunction`.
 */
interface IBS {
    function getTokenUsdPrice(address) external view returns (uint256);
}

contract GaugePointPrice is GaugePointFacet {
    address immutable beanstalk;
    address immutable token;
    uint256 immutable priceThreshold;
    uint256 immutable gaugePointsPrice;

    /**
     * @param _beanstalk The address of the Beanstalk contract.
     * @param _token The address of the token to check the price of.
     * @param _priceThreshold The price threshold to check against.
     * @param _gaugePointsPrice The gauge points price to return when the price is below the threshold.
     * @dev `priceThreshold` should have 6 decimal precision, regardless of token decimals.
     */
    constructor(
        address _beanstalk,
        address _token,
        uint256 _priceThreshold,
        uint256 _gaugePointsPrice
    ) {
        beanstalk = _beanstalk;
        token = _token;
        priceThreshold = _priceThreshold;
        gaugePointsPrice = _gaugePointsPrice;
    }

    /**
     * @notice priceGaugePointFunction
     * checks that the price of `token` is above `priceThreshold`.
     * When below the priceThreshold, the function returns the minimum of
     * `currentGaugepoints` and `gaugePointsPrice`.
     * Else, use the defaultGaugePointFunction implmentation defined in `GaugePointFacet`.
     *
     * @dev `Price` is fetched from Beanstalk via {OracleFacet.getUsdPrice}. An instanteous Lookback
     * is used to get the most recent price from the Oracle.
     */
    function priceGaugePointFunction(
        uint256 currentGaugePoints,
        uint256 optimalPercentDepositedBdv,
        uint256 percentOfDepositedBdv,
        bytes memory data
    ) public view returns (uint256 newGaugePoints) {
        try IBS(beanstalk).getTokenUsdPrice(token) returns (uint256 price) {
            if (priceThreshold >= price) {
                return
                    currentGaugePoints > gaugePointsPrice ? gaugePointsPrice : currentGaugePoints;
            } else {
                return
                    defaultGaugePointFunction(
                        currentGaugePoints,
                        optimalPercentDepositedBdv,
                        percentOfDepositedBdv,
                        data
                    );
            }
        } catch {
            // If the price cannot be fetched, assume price manipulation.
            return currentGaugePoints > gaugePointsPrice ? gaugePointsPrice : currentGaugePoints;
        }
    }

    function getBeanstalk() external view returns (address) {
        return beanstalk;
    }

    function getToken() external view returns (address) {
        return token;
    }

    function getPriceThreshold() external view returns (uint256) {
        return priceThreshold;
    }

    function getGaugePointsPrice() external view returns (uint256) {
        return gaugePointsPrice;
    }
}
