/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "contracts/libraries/LibAppStorage.sol";


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

    // The index of the ETH token address in the BEAN/ETH Well.
    uint256 internal constant BEAN_ETH_WELL_ETH_INDEX = 1;


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

    /**
     * @dev Sets the USD/ETH price in {AppStorage} given a set of ratios.
     * It assumes that the ratios correspond to a BEAN/ETH Constant Product Well indexes.
     */
    function setUsdEthPrice(uint256[] memory ratios) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // If the reserves length is 0, then {LibWellMinting} failed to compute
        // valid manipulation resistant reserves and thus the price is set to 0
        // indicating that the oracle failed to compute a valid price this Season.
        if (ratios.length == 0) {
            s.usdEthPrice = 0;
        } else {
            s.usdEthPrice = ratios[BEAN_ETH_WELL_ETH_INDEX];
        }
    }

    /**
     * @dev Returns the USD / ETH price stored in {AppStorage}.
     * The USD / ETH price is used twice in sunrise(): Once during {LibEvaluate.EvalPrice}
     * and another at {LibEvaluate.Calc}. After use, {resetUsdEthPrice} should be called.
     */
    function getUsdEthPrice() internal view returns (uint price) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        price = s.usdEthPrice;
    }

    /**
     * @notice resets s.usdEthPrice to 1. 
     * @dev should be called at the end of sunrise() once the 
     * usdEthPrice is not needed anymore to save gas.
     */
    function resetUsdEthPrice() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.usdEthPrice = 1;
    }
}
