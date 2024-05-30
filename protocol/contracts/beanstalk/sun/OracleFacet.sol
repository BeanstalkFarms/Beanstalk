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
    function getUsdPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token, 0);
    }

    function getUsdPriceWithLookback(
        address token,
        uint256 lookback
    ) external view returns (uint256) {
        return LibUsdOracle.getUsdPrice(token, lookback);
    }

    function getTokenPrice(address token) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token, 0);
    }

    function getTokenPrice(address token, uint256 lookback) external view returns (uint256) {
        return LibUsdOracle.getTokenPrice(token, lookback);
    }

    function getTokenPriceFromExternal(
        address token,
        uint256 lookback
    ) external view returns (uint256 tokenPrice) {
        return LibUsdOracle.getTokenPriceFromExternal(token, lookback);
    }
}
