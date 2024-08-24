/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {C} from "contracts/C.sol";
import {LibOracleHelpers} from "contracts/libraries/Oracle/LibOracleHelpers.sol";

/**
 * @title Eth Usd Oracle Library
 * @notice Contains functionalty to fetch a manipulation resistant ETH/USD or USD/ETH price.
 * @dev
 * The Oracle uses the ETH/USD or USD/ETH Chainlink Oracle to fetch the price.
 * The oracle will fail (return 0) if the Chainlink Oracle is broken or frozen (See: {LibChainlinkOracle}).
 **/
library LibEthUsdOracle {
    using LibRedundantMath256 for uint256;

    address constant ETH_USD_CHAINLINK_PRICE_AGGREGATOR =
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    uint256 constant ETH_DECIMALS = 18;

    /**
     * @dev Returns the instantaneous USD/ETH price
     * Return value has 18 decimal precision.
     * Returns 0 if the USD/ETH Chainlink Oracle is broken or frozen.
     **/
    function getUsdEthPrice() internal view returns (uint256) {
        return getUsdEthPrice(0);
    }

    /**
     * @dev Returns the USD/ETH price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Return value has 18 decimal precision.
     * Returns 0 if the USD/ETH Chainlink Oracle is broken or frozen.
     **/
    function getUsdEthPrice(uint256 lookback) internal view returns (uint256) {
        return
            LibChainlinkOracle.getTokenPrice(
                ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                ETH_DECIMALS,
                lookback
            );
    }

    /**
     * @dev Returns the instantaneous ETH/USD price
     * Return value has 6 decimal precision.
     * Returns 0 if the ETH/USD Chainlink Oracle is broken or frozen.
     **/
    function getEthUsdPrice() internal view returns (uint256) {
        return getEthUsdPrice(0);
    }

    /**
     * @dev Returns the ETH/USD price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Return value has 6 decimal precision.
     * Returns 0 if the ETH/USD Chainlink Oracle is broken or frozen.
     **/
    function getEthUsdPrice(uint256 lookback) internal view returns (uint256) {
        return
            LibChainlinkOracle.getTokenPrice(
                ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                0,
                lookback
            );
    }
}
