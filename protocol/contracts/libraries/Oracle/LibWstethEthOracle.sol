/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {C} from "contracts/C.sol";
import {LibOracleHelpers} from "contracts/libraries/Oracle/LibOracleHelpers.sol";

interface IWsteth {
    function stEthPerToken() external view returns (uint256);
}

/**
 * @title Wsteth Eth Oracle Library
 * @author brendan
 * @notice Computes the wstETH:ETH price.
 * @dev
 * The oracle reads from 4 data sources:
 * a. wstETH:stETH Redemption Rate: (0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0)
 * b. stETH:ETH Chainlink Oracle: (0x86392dC19c0b719886221c78AB11eb8Cf5c52812)
 * c. wstETH:ETH Uniswap Pool: (0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa)
 * d. stETH:ETH Redemption: (1:1)
 *
 * It then computes the wstETH:ETH price in 3 ways:
 * 1. wstETH -> ETH via Chainlink: a * b
 * 2. wstETH -> ETH via wstETH:ETH Uniswap Pool: c * 1
 * 3. wstETH -> ETH via stETH redemption: a * d
 *
 * It then computes a wstETH:ETH price by taking the minimum of (3) and either the average of (1) and (2)
 * if (1) and (2) are within `MAX_DIFFERENCE` from each other or (1).
 **/
library LibWstethEthOracle {
    using LibRedundantMath256 for uint256;

    // The maximum percent difference such that the oracle assumes no manipulation is occuring.
    uint256 constant MAX_DIFFERENCE = 0.01e18; // 1%
    uint256 constant CHAINLINK_DENOMINATOR = 1e6;
    uint128 constant ONE = 1e18;
    uint128 constant AVERAGE_DENOMINATOR = 2;
    uint128 constant PRECISION_DENOMINATOR = 1e12;

    /**
     * @dev Returns the instantaneous wstETH/ETH price
     * Return value has 6 decimal precision.
     * Returns 0 if the either the Chainlink Oracle or Uniswap Oracle cannot fetch a valid price.
     **/
    function getWstethEthPrice() internal view returns (uint256) {
        return getWstethEthPrice(0);
    }

    /**
     * @dev Returns the wstETH/ETH price with the option of using a TWA lookback.
     * Return value has 6 decimal precision.
     * Returns 0 if the either the Chainlink Oracle or Uniswap Oracle cannot fetch a valid price.
     **/
    function getWstethEthPrice(uint256 lookback) internal view returns (uint256 wstethEthPrice) {
        uint256 chainlinkPrice = lookback == 0
            ? LibChainlinkOracle.getPrice(
                C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_DAY_TIMEOUT
            )
            : LibChainlinkOracle.getTwap(
                C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
                LibChainlinkOracle.FOUR_DAY_TIMEOUT,
                lookback
            );

        // Check if the chainlink price is broken or frozen.
        if (chainlinkPrice == 0) return 0;

        uint256 stethPerWsteth = IWsteth(C.WSTETH).stEthPerToken();

        chainlinkPrice = chainlinkPrice.mul(stethPerWsteth).div(CHAINLINK_DENOMINATOR);

        // Uniswap V3 only supports a uint32 lookback.
        if (lookback > type(uint32).max) return 0;
        uint256 uniswapPrice = LibUniswapOracle.getTwap(
            lookback == 0 ? LibUniswapOracle.FIFTEEN_MINUTES : uint32(lookback),
            C.WSTETH_ETH_UNIV3_01_POOL,
            C.WSTETH,
            C.WETH,
            ONE
        );

        // Check if the uniswapPrice oracle fails.
        if (uniswapPrice == 0) return 0;

        if (LibOracleHelpers.getPercentDifference(chainlinkPrice, uniswapPrice) < MAX_DIFFERENCE) {
            wstethEthPrice = chainlinkPrice.add(uniswapPrice).div(AVERAGE_DENOMINATOR);
            if (wstethEthPrice > stethPerWsteth) wstethEthPrice = stethPerWsteth;
            wstethEthPrice = wstethEthPrice.div(PRECISION_DENOMINATOR);
        }
    }
}
