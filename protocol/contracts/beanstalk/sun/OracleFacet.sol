/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";

/**
 * @author pizzaman1337
 * @title Oracle Facet
 * @notice Exposes Oracle Functionality
 **/
contract OracleFacet is Invariable, ReentrancyGuard {
    /**
     * @notice Fetches the amount of tokens equal to 1 USD for a given token.
     * @param token address of the token to get the amount for.
     */
    function getUsdPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token, 0);
    }

    /**
     * @notice Returns the amount of tokens equal to 1 USD for a given token,
     * with a lookback. Used to protect against manipulation.
     * @param token address of the token to get the amount for.
     * @param lookback the amount of time to look back in seconds.
     */
    function getUsdPriceWithLookback(
        address token,
        uint256 lookback
    ) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token, lookback);
    }

    /**
     * @notice Fetches the amount of USD equal 1 token is worth.
     * @param token address of token to get the price of.
     */
    function getTokenPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token, 0);
    }

    /**
     * @notice Fetches the amount of USD equal 1 token is worth, using a lookback
     * @param token address of token to get the price of.
     */
    function getTokenPrice(address token, uint256 lookback) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token, lookback);
    }

    /**
     * @notice Fetches the amount of tokens equal to 1 USD, using the oracle implementation.
     * @param token address of token to get the price of.
     * @param lookback the amount of time to look back in seconds.
     */
    function getTokenPriceFromExternal(
        address token,
        uint256 lookback
    ) external view returns (uint256 tokenPrice) {
        return LibUsdOracle.getTokenPriceFromExternal(token, lookback);
    }
}
