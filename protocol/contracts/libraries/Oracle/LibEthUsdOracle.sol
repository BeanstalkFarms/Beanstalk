/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {C} from "contracts/C.sol";
import {LibOracleHelpers} from "contracts/libraries/Oracle/LibOracleHelpers.sol";

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

    /////////////////// ORACLES ///////////////////
    address constant ETH_USD_CHAINLINK_PRICE_AGGREGATOR =
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    ///////////////////////////////////////////////

    // The maximum percent different such that it is acceptable to use the greedy approach.
    uint256 constant MAX_GREEDY_DIFFERENCE = 0.003e18; // 0.3%'

    // The maximum percent difference such that the oracle assumes no manipulation is occuring.
    uint256 constant MAX_DIFFERENCE = 0.01e18; // 1%

    function getEthUsdPriceFromStorageIfSaved() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 priceInStorage = s.usdTokenPrice[C.BEAN_ETH_WELL];

        if (priceInStorage == 1) {
            return getEthUsdPrice();
        }
        return priceInStorage;
    }

    /**
     * @dev Returns the instantaneous ETH/USD price
     * Return value has 6 decimal precision.
     * Returns 0 if the Eth Usd Oracle cannot fetch a manipulation resistant price.
     **/
    function getEthUsdPrice() internal view returns (uint256) {
        return LibChainlinkOracle.getPrice(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, LibChainlinkOracle.FOUR_HOUR_TIMEOUT);
    }

    /**
     * @dev Returns the ETH/USD price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Return value has 6 decimal precision.
     * Returns 0 if the Eth Usd Oracle cannot fetch a manipulation resistant price.
     * A lookback of 900 seconds is used in Uniswap V3 pools for instantaneous price queries.
     * If using a non-zero lookback, it is recommended to use a substantially large
     * `lookback` (> 900 seconds) to protect against manipulation.
     **/
    function getEthUsdPrice(uint256 lookback) internal view returns (uint256) {
        return
            lookback > 0
                ? LibChainlinkOracle.getTwap(
                    ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                    LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                    lookback
                )
                : LibChainlinkOracle.getPrice(
                    ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                    LibChainlinkOracle.FOUR_HOUR_TIMEOUT
                );
    }
}
