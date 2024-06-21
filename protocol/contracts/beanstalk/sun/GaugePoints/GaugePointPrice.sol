/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;

import {GaugePointFacet} from "./GaugePointFacet.sol";

/**
 * @title GaugePointPrice
 * @author Brean
 * @notice GaugePointPrice implments `priceGaugePointFunction`.
 */
interface IBS {
    function getTokenPrice(address) external view returns (uint256);
}

contract GaugePointPrice is GaugePointFacet {
    address immutable beanstalk;
    address immutable token;
    uint256 immutable priceThreshold;
    uint256 immutable gaugePointsPrice;

    /**
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
        uint256 percentOfDepositedBdv
    ) public view returns (uint256 newGaugePoints) {
        uint256 price = IBS(beanstalk).getTokenPrice(token);
        if (priceThreshold >= price) {
            return currentGaugePoints > gaugePointsPrice ? gaugePointsPrice : currentGaugePoints;
        } else {
            return
                defaultGaugePointFunction(
                    currentGaugePoints,
                    optimalPercentDepositedBdv,
                    percentOfDepositedBdv
                );
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
