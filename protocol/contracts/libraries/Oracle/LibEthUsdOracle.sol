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
 **/
library LibEthUsdOracle {

    using SafeMath for uint256;

    uint256 constant MAX_GREEDY_DIFFERENCE = 0.005e18; // 0.5%
    uint256 constant MAX_DIFFERENCE = 0.02e18; // 2%
    uint256 constant ONE = 1e18;
  
    function getEthUsdPrice() internal view returns (uint256) {
        uint256 chainlinkPrice = LibChainlinkOracle.getEthUsdPrice();

        uint256 usdcPrice = LibUniswapOracle.getEthUsdcPrice();
        uint256 usdcChainlinkPercentDiff = getPercentDifference(usdcPrice, chainlinkPrice);

        if (usdcChainlinkPercentDiff < MAX_GREEDY_DIFFERENCE) {
            return chainlinkPrice.add(usdcPrice).div(2);
        }

        uint256 usdtPrice = LibUniswapOracle.getEthUsdtPrice();
        uint256 usdtChainlinkPercentDiff = getPercentDifference(usdtPrice, chainlinkPrice);

        if (usdtChainlinkPercentDiff < usdcChainlinkPercentDiff) {
            if (usdtChainlinkPercentDiff < MAX_DIFFERENCE) {
                return chainlinkPrice.add(usdtPrice).div(2);
            }
            return 0;
        } else {
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
            ONE - percentDifference;
    }
}
