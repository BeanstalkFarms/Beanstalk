/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
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
 * b. stETH:USD Chainlink Oralce: (0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8)
 * c. wstETH:ETH Uniswap Pool: (0xDC24316b9AE028F1497c275EB9192a3Ea0f67022)
 * d. stETH:ETH Redemption: ()
 *
 * It then computes the wstETH:ETH price in 3 ways:
 * 1. wstETH -> ETH via Chainlink: c * a
 * 2. wstETH -> ETH via stETH:ETH Curve Pool: c * b
 * 3. wstETH -> ETH via stETH redemption: c * 1
 *
 * It then computes a wstETH:ETH price by taking the minimum of (3) and either the average of (1) and (2)
 * if (1) and (2) are within `MAX_DIFFERENCE` from each other or (1).
 **/
library LibWstethEthOracle {
    using SafeMath for uint256;

    // The maximum percent difference such that the oracle assumes no manipulation is occuring.
    uint256 constant MAX_DIFFERENCE = 0.01e18; // 1%
    uint256 constant CHAINLINK_DENOMINATOR = 1e6;
    uint128 constant ONE = 1e18;
    uint128 constant AVERAGE_DENOMINATOR = 2;
    uint128 constant PRECISION_DENOMINATOR = 1e12;

    /////////////////// ORACLES ///////////////////
    address constant WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR =
        0x86392dC19c0b719886221c78AB11eb8Cf5c52812;
    address internal constant WSTETH_ETH_UNIV3_01_POOL = 0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa; // 0.01% pool
    ///////////////////////////////////////////////

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

        uint256 stethPerWsteth = IWsteth(C.WSTETH).stEthPerToken();
        uint256 chainlinkPrice = lookback == 0 ? 
            LibChainlinkOracle.getPrice(WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR, LibChainlinkOracle.FOUR_DAY_TIMEOUT) :
            LibChainlinkOracle.getTwap(WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR, LibChainlinkOracle.FOUR_DAY_TIMEOUT, lookback);

        chainlinkPrice = chainlinkPrice.mul(stethPerWsteth).div(CHAINLINK_DENOMINATOR);

        // Check if the chainlink price is broken or frozen.
        if (chainlinkPrice == 0) return 0;

        if (lookback > type(uint32).max) return 0;
        uint256 uniswapPrice = LibUniswapOracle.getTwap(
            lookback == 0 ? LibUniswapOracle.FIFTEEN_MINUTES :
            uint32(lookback),
            WSTETH_ETH_UNIV3_01_POOL, C.WSTETH, C.WETH, ONE
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
