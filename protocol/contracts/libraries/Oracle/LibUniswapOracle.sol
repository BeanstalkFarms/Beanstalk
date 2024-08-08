/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {C} from "contracts/C.sol";
import {LibUniswapOracleLibrary} from "./LibUniswapOracleLibrary.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/**
 * @title Uniswap Oracle Library
 * @notice Contains functionalty to read prices from Uniswap V3 pools.
 * @dev currently supports:
 * - ETH:USDC price from the ETH:USDC 0.05% pool
 * - ETH:USDT price from the ETH:USDT 0.05% pool
 **/
library LibUniswapOracle {
    // All instantaneous queries of Uniswap Oracles should use a 15 minute lookback.
    uint32 internal constant FIFTEEN_MINUTES = 900;
    uint256 constant PRECISION = 1e6;

    /**
     * @notice Given a tick and a token amount, calculates the amount of token received in exchange
     * @param baseTokenAmount Amount of baseToken to be converted.
     * @param baseToken Address of the ERC20 token contract used as the baseAmount denomination.
     * @param quoteToken Address of the ERC20 token contract used as the quoteAmount denomination.
     * @return price Amount of quoteToken. Value has 6 decimal precision.
     */
    function getTwap(
        uint32 lookback,
        address pool,
        address baseToken,
        address quoteToken,
        uint128 baseTokenAmount
    ) internal view returns (uint256 price) {
        (bool success, int24 tick) = consult(pool, lookback);
        if (!success) return 0;

        price = LibUniswapOracleLibrary.getQuoteAtTick(
            tick,
            baseTokenAmount,
            baseToken,
            quoteToken
        );

        uint256 baseTokenDecimals = IERC20Decimals(baseToken).decimals();
        uint256 quoteTokenDecimals = IERC20Decimals(quoteToken).decimals();
        int256 factor = int256(baseTokenDecimals) - int256(quoteTokenDecimals);

        // decimals are the same. i.e. DAI/WETH
        if (factor == 0) return (price * PRECISION) / (10 ** baseTokenDecimals);

        // scale decimals
        if (factor > 0) {
            price = price * (10 ** uint256(factor));
        } else {
            price = price / (10 ** uint256(-factor));
        }

        // set 1e6 precision
        price = (price * PRECISION) / (10 ** baseTokenDecimals);
    }

    /**
     * @dev A variation of {OracleLibrary.consult} that returns just the arithmetic mean tick and returns 0 on failure
     * instead of reverting if {IUniswapV3Pool.observe} reverts.
     * https://github.com/Uniswap/v3-periphery/blob/51f8871aaef2263c8e8bbf4f3410880b6162cdea/contracts/libraries/OracleLibrary.sol
     */
    function consult(
        address pool,
        uint32 secondsAgo
    ) internal view returns (bool success, int24 arithmeticMeanTick) {
        require(secondsAgo != 0, "BP");

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        try IUniswapV3Pool(pool).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
            arithmeticMeanTick = SafeCast.toInt24(
                int256(tickCumulativesDelta / int56(uint56(secondsAgo)))
            );
            // Always round to negative infinity
            if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(secondsAgo)) != 0))
                arithmeticMeanTick--;
            success = true;
        } catch {}
    }
}
