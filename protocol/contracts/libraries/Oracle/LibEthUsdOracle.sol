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
 * The Oracle uses the ETH/USD Chainlink Oracle to fetch the price.
 * The oracle will fail (return 0) if the Chainlink Oracle is broken or frozen (See: {LibChainlinkOracle}).
 **/
library LibEthUsdOracle {
    using SafeMath for uint256;

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
     * Returns 0 if the ETH/USD Chainlink Oracle is broken or frozen.
     **/
    function getEthUsdPrice() internal view returns (uint256) {
        return
            LibChainlinkOracle.getPrice(
                C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT
            );
    }

    /**
     * @dev Returns the ETH/USD price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Return value has 6 decimal precision.
     * Returns 0 if the ETH/USD Chainlink Oracle is broken or frozen.
     **/
    function getEthUsdPrice(uint256 lookback) internal view returns (uint256) {
        return
            lookback > 0
                ? LibChainlinkOracle.getTwap(
                    C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                    LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                    lookback
                )
                : LibChainlinkOracle.getPrice(
                    C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                    LibChainlinkOracle.FOUR_HOUR_TIMEOUT
                );
    }
}
