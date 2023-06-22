/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Eth Usd Oracle Library
 * @notice Contains functionalty to fetch a manipulation resistant ETH/USD price.
 * @dev
 * The Oracle uses a greey approach to return the average price between the
 * current price returned ETH/USD Chainlink Oracle and either the ETH/USDC
 * Uniswap V3 0.3 fee pool and the ETH/USDT Uniswap V3 0.3 fee pool depending
 * on which is closer. 
 
 * The approach is greedy as if the ETH/USDC Uniswap price is sufficiently close
 * to the Chainlink Oracle price (See {MAX_GREEDY_DIFFERENCE}), then the Oracle
 * will not check the ETH/USDT Uniswap Price to save gas.
 * 
 * There are several conditions that will cause the oracle to fail:
 * 1. If the price in both Uniswap pools deviate from the Chainlink price 
 *    by a sufficiently large percent (See {MAX_DIFFERENCE}).
 * 2. If the Chainlink Oracle is broken or frozen (See: {LibChainlinkOracle}).
 **/
library LibEthUsdOracle {

    using SafeMath for uint256;

    // The maximum percent different such that it is acceptable to use the greedy approach.
    uint256 constant MAX_GREEDY_DIFFERENCE = 0.005e18; // 0.5%

    // The maximum percent difference such that the oracle assumes no manipulation is occuring.
    uint256 constant MAX_DIFFERENCE = 0.02e18; // 2%
    uint256 constant ONE = 1e18;

    /**
     * @dev Returns the ETH/USD price.
     * Return value has 6 decimal precision.
     * Returns 0 if the Eth Usd Oracle cannot fetch a manipulation resistant price.
    **/
    function getEthUsdPrice() internal view returns (uint256) {

        uint256 chainlinkPrice = LibChainlinkOracle.getEthUsdPrice();
        // Check if the chainlink price is broken or frozen.
        if (chainlinkPrice == 0) return 0;

        uint256 usdcPrice = LibUniswapOracle.getEthUsdcPrice();
        uint256 usdcChainlinkPercentDiff = getPercentDifference(usdcPrice, chainlinkPrice);

        // Check if the USDC price and the Chainlink Price are sufficiently close enough
        // to warrant using the greedy approach.
        if (usdcChainlinkPercentDiff < MAX_GREEDY_DIFFERENCE) {
            return chainlinkPrice.add(usdcPrice).div(2);
        }

        uint256 usdtPrice = LibUniswapOracle.getEthUsdtPrice();
        uint256 usdtChainlinkPercentDiff = getPercentDifference(usdtPrice, chainlinkPrice);

        // Check whether the USDT or USDC price is closer to the Chainlink price.
        if (usdtChainlinkPercentDiff < usdcChainlinkPercentDiff) {
            // Check whether the USDT price is too far from the Chainlink price.
            if (usdtChainlinkPercentDiff < MAX_DIFFERENCE) {
                return chainlinkPrice.add(usdtPrice).div(2);
            }
            return 0;
        } else {
            // Check whether the USDC price is too far from the Chainlink price.
            if (usdcChainlinkPercentDiff < MAX_DIFFERENCE) {
                return chainlinkPrice.add(usdcPrice).div(2);
            }
            return 0;
        }
    }

    /**
     * Gets the percent difference between two values with 18 decimal precision.
     */
    function getPercentDifference(uint x, uint y) internal view returns (uint256 percentDifference) {
        percentDifference = x.mul(ONE).div(y);
        percentDifference = x > y ?
            percentDifference - ONE :
            ONE - percentDifference; // SafeMath unnecessary due to conditional check
    }
}
