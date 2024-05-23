// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibUsdOracle, LibEthUsdOracle, LibWstethUsdOracle} from "contracts/libraries/Oracle/LibUsdOracle.sol";
import {LibWstethEthOracle} from "contracts/libraries/Oracle/LibWstethEthOracle.sol";

/**
 * @title UsdOracle
 * @author Publius
 * @notice Holds functions to query USD prices of tokens.
 */
contract UsdOracle {
    // USD : Token

    function getUsdTokenPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token);
    }

    function getUsdTokenTwap(address token, uint256 lookback) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token, lookback);
    }

    // Token : USD

    function getTokenUsdPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token);
    }

    function getTokenUsdTwap(address token, uint256 lookback) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token, lookback);
    }

    // ETH : USD

    function getEthUsdPrice() external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice();
    }

    function getEthUsdTwap(uint256 lookback) external view returns (uint256) {
        return LibEthUsdOracle.getEthUsdPrice(lookback);
    }

    // WstETH : USD

    function getWstethUsdPrice() external view returns (uint256) {
        return LibWstethUsdOracle.getWstethUsdPrice();
    }

    function getWstethUsdTwap(uint256 lookback) external view returns (uint256) {
        return LibWstethUsdOracle.getWstethUsdPrice(lookback);
    }

    // WstETH : ETH

    function getWstethEthPrice() external view returns (uint256) {
        return LibWstethEthOracle.getWstethEthPrice();
    }

    function getWstethEthTwap(uint256 lookback) external view returns (uint256) {
        return LibWstethEthOracle.getWstethEthPrice(lookback);
    }
}
