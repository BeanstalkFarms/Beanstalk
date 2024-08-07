/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibEthUsdOracle} from "./LibEthUsdOracle.sol";
import {LibUniswapOracle} from "./LibUniswapOracle.sol";
import {LibChainlinkOracle} from "./LibChainlinkOracle.sol";
import {LibWstethUsdOracle} from "./LibWstethUsdOracle.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {Implementation} from "contracts/beanstalk/storage/System.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

interface ChainlinkPriceFeedRegistry {
    function getFeed(address base, address quote) external view returns (address aggregator);
}

/**
 * @title Eth Usd Oracle Library
 * @notice Contains functionalty to fetch the manipulation resistant USD price of different tokens.
 * @dev currently supports:
 * - ETH/USD price
 **/
library LibUsdOracle {
    using LibRedundantMath256 for uint256;

    // the lookup registry for chainlink price feed given a token address.
    // the chainlink registry address differs between networks.
    address constant chainlinkRegistry = 0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf;

    uint256 constant CHAINLINK_DENOMINATOR = 1e6;

    function getUsdPrice(address token) internal view returns (uint256) {
        return getUsdPrice(token, 0);
    }

    /**
     * @dev Returns the price of a given token in in USD with the option of using a lookback. (Usd:token Price)
     * `lookback` should be 0 if the instantaneous price is desired. Otherwise, it should be the
     * TWAP lookback in seconds.
     * If using a non-zero lookback, it is recommended to use a substantially large `lookback`
     * (> 900 seconds) to protect against manipulation.
     */
    function getUsdPrice(address token, uint256 lookback) internal view returns (uint256) {
        if (token == C.WETH) {
            return LibEthUsdOracle.getUsdEthPrice(lookback);
        }
        if (token == C.WSTETH) {
            return LibWstethUsdOracle.getUsdWstethPrice(lookback);
        }
        // tokens that use the custom oracle implementation are called here.
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
        // oracles that are implmented within beanstalk should be placed here.
        if (token == C.WETH) {
            return LibEthUsdOracle.getEthUsdPrice(lookback);
        }
        if (token == C.WSTETH) {
            return LibWstethUsdOracle.getWstethUsdPrice(lookback);
        }

        // tokens that use the custom oracle implementation are called here.
        return getTokenPriceFromExternal(token, 0, lookback);
    }

    /**
     * @notice gets the token price from an external oracle.
     * @dev if address is 0, use the current contract.
     * If encodeType is 0x01, use the default chainlink implementation.
     * Returns 0 rather than reverting if the call fails.
     */
    function getTokenPriceFromExternal(
        address token,
        uint256 tokenDecimals,
        uint256 lookback
    ) internal view returns (uint256 tokenPrice) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Implementation memory oracleImpl = s.sys.oracleImplementation[token];

        // If the encode type is type 1, use the default chainlink implementation instead.
        // `target` refers to the address of the price aggergator implmenation
        if (oracleImpl.encodeType == bytes1(0x01)) {
            // if the address in the oracle implementation is 0, use the chainlink registry to lookup address
            address chainlinkOraclePriceAddress = oracleImpl.target;
            if (chainlinkOraclePriceAddress == address(0)) {
                // use the chainlink registry
                chainlinkOraclePriceAddress = ChainlinkPriceFeedRegistry(chainlinkRegistry).getFeed(
                    token,
                    0x0000000000000000000000000000000000000348
                ); // 0x0348 is the address for USD
            }

            // todo: need to update timeout
            return
                LibChainlinkOracle.getTokenPrice(
                    chainlinkOraclePriceAddress,
                    LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                    tokenDecimals,
                    lookback
                );
        } else if (oracleImpl.encodeType == bytes1(0x02)) {
            // if the encodeType is type 2, use a uniswap oracle implementation.

            // the uniswap oracle implementation combines the use of the chainlink and uniswap oracles.
            // the chainlink oracle is used to get the price of the non-oracle token in order to

            address chainlinkToken = IUniswapV3PoolImmutables(oracleImpl.target).token0();

            if (chainlinkToken == token) {
                chainlinkToken = IUniswapV3PoolImmutables(oracleImpl.target).token1();
            }

            // get twap from the `chainlinkToken` to `token`
            // exchange 1 `chainlinkToken` for `token`
            tokenPrice = LibUniswapOracle.getTwap(
                lookback == 0 ? LibUniswapOracle.FIFTEEN_MINUTES : uint32(lookback),
                oracleImpl.target,
                token,
                chainlinkToken,
                uint128(10 ** IERC20Decimals(token).decimals())
            );

            // call chainlink oracle from the OracleImplmentation contract
            Implementation memory chainlinkOracleImpl = s.sys.oracleImplementation[chainlinkToken];
            address chainlinkOraclePriceAddress = chainlinkOracleImpl.target;

            if (chainlinkOraclePriceAddress == address(0)) {
                // use the chainlink registry
                chainlinkOraclePriceAddress = ChainlinkPriceFeedRegistry(chainlinkRegistry).getFeed(
                    chainlinkToken,
                    0x0000000000000000000000000000000000000348
                ); // 0x0348 is the address for USD
            }

            uint256 chainlinkTokenPrice = LibChainlinkOracle.getTokenPrice(
                chainlinkOraclePriceAddress,
                LibChainlinkOracle.FOUR_HOUR_TIMEOUT,
                0,
                lookback
            );

            return tokenPrice.mul(chainlinkTokenPrice).div(CHAINLINK_DENOMINATOR);
        }

        // If the oracle implementation address is not set, use the current contract.
        address target = oracleImpl.target;
        if (target == address(0)) target = address(this);

        (bool success, bytes memory data) = target.staticcall(
            abi.encodeWithSelector(oracleImpl.selector, tokenDecimals, lookback)
        );

        if (!success) return 0;
        assembly {
            tokenPrice := mload(add(data, add(0x20, 0)))
        }
    }
}
