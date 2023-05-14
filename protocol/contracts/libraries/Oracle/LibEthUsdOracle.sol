/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author Publius
 * @title Oracle fetches the usd price of a given token
 **/

import {console} from "hardhat/console.sol";

library LibEthUsdOracle {

    using SafeMath for uint256;

    uint256 constant MAX_GREEDY_DIFFERENCE = 0.005e18; // 0.5%
    uint256 constant MAX_DIFFERENCE = 0.01e18; // 0.5%
    uint256 constant ONE = 1e18;
  
    function getEthUsdPrice() internal view returns (uint256) {
        uint256 chainlinkPrice = LibChainlinkOracle.getEthUsdPrice();
        console.log("Chainlink: %s", chainlinkPrice);
        uint256 usdcPrice = LibUniswapOracle.getEthUsdcPrice();
        console.log("USDC: %s", chainlinkPrice);

        uint256 usdcChainlinkPercentDiff = usdcPrice.mul(1e18).div(chainlinkPrice);
        usdcChainlinkPercentDiff = usdcPrice > chainlinkPrice ? 
            usdcChainlinkPercentDiff - ONE :
            ONE - usdcChainlinkPercentDiff;

        if (usdcChainlinkPercentDiff < MAX_GREEDY_DIFFERENCE) {
            return chainlinkPrice.add(usdcPrice).div(2);
        }

        uint256 usdtPrice = LibUniswapOracle.getEthUsdtPrice();
        console.log("USDT: %s", chainlinkPrice);

        uint256 usdtChainlinkPercentDiff = usdtPrice.mul(1e18).div(chainlinkPrice);
        usdtChainlinkPercentDiff = usdtPrice > chainlinkPrice ? 
            usdtChainlinkPercentDiff - ONE :
            ONE - usdtChainlinkPercentDiff;

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
}
