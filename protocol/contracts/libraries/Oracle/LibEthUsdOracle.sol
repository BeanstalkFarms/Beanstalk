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
 * The Oracle uses a greedy approach to return the average price between the
 * current price returned ETH/USD Chainlink Oracle and either the ETH/USDC
 * Uniswap V3 0.05% fee pool and the ETH/USDT Uniswap V3 0.05% fee pool depending
 * on which is closer. 
 * 
 * If the prices in the ETH/USDC Uniswap V3 0.05% fee pool and USD/USDT Uniswap V3 0.05% fee pool are
 * greater than `MAX_DIFFERENCE` apart, then the oracle uses the Chainlink price to maximize liveness.
 * 
 * The approach is greedy as if the ETH/USDC Uniswap price is sufficiently close
 * to the Chainlink Oracle price (See {MAX_GREEDY_DIFFERENCE}), then the Oracle
 * will not check the ETH/USDT Uniswap Price to save gas.
 * 
 * The oracle will fail if the Chainlink Oracle is broken or frozen (See: {LibChainlinkOracle}).
 **/
library LibEthUsdOracle {

    using SafeMath for uint256;

    // The maximum percent different such that it is acceptable to use the greedy approach.
    uint256 constant MAX_GREEDY_DIFFERENCE = 0.003e18; // 0.3%

    // The maximum percent difference such that the oracle assumes no manipulation is occuring.
    uint256 constant MAX_DIFFERENCE = 0.01e18; // 1%
    uint256 constant ONE = 1e18;

    // The lookback used for Uniswap Oracles when querying the instantaneous USD price.
    uint32 constant INSTANT_LOOKBACK = 900;

    /**
     * @dev Returns the instantaneous ETH/USD price
     * Return value has 6 decimal precision.
     * Returns 0 if the Eth Usd Oracle cannot fetch a manipulation resistant price.
     **/
    function getEthUsdPrice() internal view returns (uint256) {
        return getEthUsdPrice(0);
    }

    /**
     * @dev Returns the ETH/USD price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Return value has 6 decimal precision.
     * Returns 0 if the Eth Usd Oracle cannot fetch a manipulation resistant price.
    **/
    function getEthUsdPrice(uint32 lookback) internal view returns (uint256) {
        uint256 chainlinkPrice = lookback > 0 ?
            LibChainlinkOracle.getEthUsdTwap(lookback) :
            LibChainlinkOracle.getEthUsdPrice();

        // Use a lookback of 900 seconds for an instantaneous price query for manipulation resistance.
        if (lookback == 0) lookback = INSTANT_LOOKBACK;

        // Check if the chainlink price is broken or frozen.
        if (chainlinkPrice == 0) return 0;

        uint256 usdcPrice = LibUniswapOracle.getEthUsdcPrice(lookback);
        uint256 usdcChainlinkPercentDiff = getPercentDifference(usdcPrice, chainlinkPrice);

        // Check if the USDC price and the Chainlink Price are sufficiently close enough
        // to warrant using the greedy approach.
        if (usdcChainlinkPercentDiff < MAX_GREEDY_DIFFERENCE) {
            return chainlinkPrice.add(usdcPrice).div(2);
        }

        uint256 usdtPrice = LibUniswapOracle.getEthUsdtPrice(lookback);
        uint256 usdtChainlinkPercentDiff = getPercentDifference(usdtPrice, chainlinkPrice);

        // Check whether the USDT or USDC price is closer to the Chainlink price.
        if (usdtChainlinkPercentDiff < usdcChainlinkPercentDiff) {
            // Check whether the USDT price is too far from the Chainlink price.
            if (usdtChainlinkPercentDiff < MAX_DIFFERENCE) {
                return chainlinkPrice.add(usdtPrice).div(2);
            }
            return chainlinkPrice;
        } else {
            // Check whether the USDC price is too far from the Chainlink price.
            if (usdcChainlinkPercentDiff < MAX_DIFFERENCE) {
                return chainlinkPrice.add(usdcPrice).div(2);
            }
            return chainlinkPrice;
        }
    }

    /**
     * Gets the percent difference between two values with 18 decimal precision.
     * @dev If x == 0 (Such as in the case of Uniswap Oracle failure), then the percent difference is calculated as 100%.
     */
    function getPercentDifference(uint x, uint y) internal pure returns (uint256 percentDifference) {
        percentDifference = x.mul(ONE).div(y);
        percentDifference = x > y ?
            percentDifference - ONE :
            ONE - percentDifference; // SafeMath unnecessary due to conditional check
    }
}
