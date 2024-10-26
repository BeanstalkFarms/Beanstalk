/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {IUniswapV3PoolImmutables} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

/**
 * @title Usd Oracle Library
 * @notice Contains functionalty to fetch the manipulation resistant USD price of different tokens.
 * @dev currently supports:
 **/
library LibUsdOracle {
    using LibRedundantMath256 for uint256;

    uint256 constant UNISWAP_DENOMINATOR = 1e6;

    function getUsdPrice(address token) internal view returns (uint256) {
        return getUsdPrice(token, 0);
    }

    /**
     * @dev Returns the price of 1 USD in terms of `token` with the option of using a lookback. (Usd:token Price)
     * `lookback` should be 0 if the instantaneous price is desired. Otherwise, it should be the
     * TWAP lookback in seconds.
     * If using a non-zero lookback, it is recommended to use a substantially large `lookback`
     * (> 900 seconds) to protect against manipulation.
     */
    function getUsdPrice(address token, uint256 lookback) internal view returns (uint256) {
        // call external implementation for token
        // note passing decimals controls pricing order (token:usd vs usd:token)
        return getTokenPriceFromExternal(token, IERC20Decimals(token).decimals(), lookback);
    }

    function getTokenPrice(address token) internal view returns (uint256) {
        return getTokenPrice(token, 0);
    }

    /**
     * @notice returns the price of a given token in USD (token:Usd Price)
     * @dev if ETH returns 1000 USD, this function returns 1000
     * (ignoring decimal precision)
     */
    function getTokenPrice(address token, uint256 lookback) internal view returns (uint256) {
        // call external implementation for token
        return getTokenPriceFromExternal(token, 0, lookback);
    }

    /**
     * @notice gets the token price from an external oracle.
     * @dev if address is 0, use the current contract.
     * If encodeType is 0x01, use the default chainlink implementation.
     * Returns 0 rather than reverting if the call fails.
     * Note: token here refers to the non bean token when quoting for a well price.
     */
    function getTokenPriceFromExternal(
        address token,
        uint256 tokenDecimals,
        uint256 lookback
    ) internal view returns (uint256 tokenPrice) {
        return getTokenPriceFromExternal(token, tokenDecimals, lookback, false);
    }

    /**
     * @notice returns the price of 1 Million USD in terms of `token` with the option of using a lookback.
     * @dev `LibWell.getRatiosAndBeanIndex` attempts to calculate the target ratios by fetching the usdPrice of each token.
     * For tokens with low decimal precision and high prices (ex. WBTC), using the usd:token price would result in a
     * large amount of precision loss. For this reason, tokens with less than 8 decimals use the 1 Million USD price instead..
     */
    function getMillionUsdPrice(address token, uint256 lookback) internal view returns (uint256) {
        return getTokenPriceFromExternal(token, IERC20Decimals(token).decimals(), lookback, true);
    }

    /**
     * @notice internal helper function for `getTokenPriceFromExternal`.
     * @dev the `isMillion` flag is used in `LibChainlinkOracle.getTokenPrice` to
     * return the MILLION_TOKEN2/TOKEN1 price, in cases where the price of TOKEN1 is extremely high (relative to token 2),
     * and when the decimals is very low.
     */
    function getTokenPriceFromExternal(
        address token,
        uint256 tokenDecimals,
        uint256 lookback,
        bool isMillion
    ) private view returns (uint256 tokenPrice) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Implementation memory oracleImpl = s.sys.oracleImplementation[token];

        // If the encode type is type 1, use the default chainlink implementation instead.
        // `target` refers to the address of the price aggergator implmentation
        if (oracleImpl.encodeType == bytes1(0x01)) {
            return
                LibChainlinkOracle.getTokenPrice(
                    oracleImpl.target, // chainlink Aggergator Address
                    abi.decode(oracleImpl.data, (uint256)), // timeout
                    tokenDecimals, // token decimals
                    lookback,
                    isMillion
                );
        } else if (oracleImpl.encodeType == bytes1(0x02)) {
            // if the encodeType is type 2, use a uniswap oracle implementation.

            // the uniswap oracle implementation combines the use of the chainlink and uniswap oracles.
            // the chainlink oracle is used to get the price of the non-oracle token (for example USDC) in order to
            // use that as a dollar representation
            address chainlinkToken = IUniswapV3PoolImmutables(oracleImpl.target).token0();

            if (chainlinkToken == token) {
                chainlinkToken = IUniswapV3PoolImmutables(oracleImpl.target).token1();
            }

            // get twap from the `chainlinkToken` to `token`
            // exchange 1 `token` for `chainlinkToken`.
            tokenPrice = LibUniswapOracle.getTwap(
                lookback == 0 ? LibUniswapOracle.FIFTEEN_MINUTES : uint32(lookback),
                oracleImpl.target,
                token,
                chainlinkToken,
                tokenDecimals == 0
                    ? uint128(10 ** IERC20Decimals(token).decimals())
                    : uint128(10 ** tokenDecimals)
            );

            // call chainlink oracle from the OracleImplmentation contract
            Implementation memory chainlinkOracle = s.sys.oracleImplementation[chainlinkToken];

            // return the CL_TOKEN/USD or USD/CL_TOKEN, depending on `tokenDecimals`.
            uint256 chainlinkTokenDecimals = IERC20Decimals(chainlinkToken).decimals();
            uint256 chainlinkTokenPrice = LibChainlinkOracle.getTokenPrice(
                chainlinkOracle.target,
                abi.decode(chainlinkOracle.data, (uint256)), // timeout
                tokenDecimals == 0 ? tokenDecimals : chainlinkTokenDecimals,
                lookback,
                false
            );

            // if token decimals != 0, Beanstalk is attempting to query the USD/TOKEN price, and
            // thus the price needs to be inverted.
            if (tokenDecimals != 0) {
                // invert tokenPrice (to get CL_TOKEN/TOKEN).
                // `tokenPrice` has 6 decimal precision (see {LibUniswapOracle.getTwap}).
                // `tokenPrice` is scaled up to 1 million units, if the `isMillion` flag is enabled.
                if (isMillion) {
                    tokenPrice = (1e12 * (10 ** tokenDecimals)) / tokenPrice;
                } else {
                    tokenPrice = (1e6 * (10 ** tokenDecimals)) / tokenPrice;
                }
                // return the USD/TOKEN price.
                // 1e6 * 1e`n` / 1e`n` = 1e6
                return (tokenPrice * chainlinkTokenPrice) / (10 ** chainlinkTokenDecimals);
            }

            return (tokenPrice * chainlinkTokenPrice) / UNISWAP_DENOMINATOR;
        }

        // Non-zero addresses are enforced in verifyOracleImplementation, this is just an extra check.
        if (oracleImpl.target == address(0)) return 0;

        // if `isMillion` is enabled, append the boolean into the oracleImpl,
        // such that the oracle implementation can use the data.
        bytes memory oracleImplData = oracleImpl.data;
        if (isMillion) {
            oracleImplData = abi.encodePacked(oracleImpl.data, isMillion);
        }

        (bool success, bytes memory data) = oracleImpl.target.staticcall(
            abi.encodeWithSelector(oracleImpl.selector, tokenDecimals, lookback, oracleImplData)
        );

        if (!success) return 0;
        assembly {
            tokenPrice := mload(add(data, add(0x20, 0)))
        }
    }
}
