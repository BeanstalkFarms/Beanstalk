/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

/**
 * @title Uniswap Oracle Library
 * @notice Contains functionalty to read prices from Uniswap V3 pools.
 * @dev currently supports:
 * - ETH:USDC price from the ETH:USDC 0.05% pool
 * - ETH:USDT price from the ETH:USDT 0.05% pool
 **/
library LibUniswapOracle {

    uint128 constant ONE_WETH = 1e18;

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of ETH denominated in USDC.
     * Return value has 6 decimal precision.
     * Returns 0 if {IUniswapV3Pool.observe} reverts.
     */
    function getEthUsdcPrice(uint32 lookback) internal view returns (uint256 price) {
        (bool success, int24 tick) = consult(C.UNIV3_ETH_USDC_POOL, lookback);
        if (!success) return 0;
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDC);
    }

    /**
     * @dev Uses the Uniswap V3 Oracle to get the price of ETH denominated in USDT.
     * Return value has 6 decimal precision.
     * Returns 0 if {IUniswapV3Pool.observe} reverts.
     */
    function getEthUsdtPrice(uint32 lookback) internal view returns (uint256 price) {
        (bool success, int24 tick) = consult(C.UNIV3_ETH_USDT_POOL, lookback);
        if (!success) return 0;
        price = OracleLibrary.getQuoteAtTick(tick, ONE_WETH, C.WETH, C.USDT);
    }

    /**
     * @dev A variation of {OracleLibrary.consult} that returns just the arithmetic mean tick and returns 0 on failure
     * instead of reverting if {IUniswapV3Pool.observe} reverts.
     * https://github.com/Uniswap/v3-periphery/blob/51f8871aaef2263c8e8bbf4f3410880b6162cdea/contracts/libraries/OracleLibrary.sol
     */
    function consult(address pool, uint32 secondsAgo)
        internal
        view
        returns (bool success, int24 arithmeticMeanTick)
    {
        require(secondsAgo != 0, 'BP');

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        try IUniswapV3Pool(pool).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
            arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgo);
            // Always round to negative infinity
            if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0)) arithmeticMeanTick--;
            success = true;
        } catch {}
    }

}
