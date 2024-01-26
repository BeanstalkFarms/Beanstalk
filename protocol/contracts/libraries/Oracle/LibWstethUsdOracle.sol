/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibWstethEthOracle, SafeMath} from "contracts/libraries/Oracle/LibWstethEthOracle.sol";
import {LibEthUsdOracle} from "contracts/libraries/Oracle/LibEthUsdOracle.sol";

interface IWsteth {
    function stEthPerToken() external view returns (uint256);
}

/**
 * @title Wsteth USD Oracle Library
 * @author brendan
 * @notice Computes the wStETH:USD price.
 * @dev
 * The oracle reads from 2 data sources:
 * a. LibWstethEthOracle
 * b. LibEthUsdOracle
 *
 * The wStEth:USD price is computed as: a * b
 **/
library LibWstethUsdOracle {
    using SafeMath for uint256;

    uint256 constant ORACLE_PRECISION = 1e6;

    /**
     * @dev Returns the instantaneous wstETH/USD price
     * Return value has 6 decimal precision.
     * Returns 0 if the either LibWstethEthOracle or LibEthUsdOracle cannot fetch a valid price.
     **/
    function getWstethUsdPrice() internal view returns (uint256) {
        return getWstethUsdPrice(0);
    }

    /**
     * @dev Returns the wstETH/USD price with the option of using a TWA lookback.
     * Return value has 6 decimal precision.
     * Returns 0 if the either LibWstethEthOracle or LibEthUsdOracle cannot fetch a valid price.
     **/
    function getWstethUsdPrice(uint256 lookback) internal view returns (uint256) {
        return LibWstethEthOracle.getWstethEthPrice(lookback).mul(
            LibEthUsdOracle.getEthUsdPrice(lookback)
        ).div(ORACLE_PRECISION);
    }
}
