/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

/**
 * @title Oracle Helpers Library
 * @author brendan
 * @notice Contains functionalty common to multiple Oracle libraries.
 **/
library LibOracleHelpers {

    uint256 constant ONE = 1e18;

    /**
     * Gets the percent difference between two values with 18 decimal precision.
     * @dev If x == 0 (Such as in the case of Uniswap Oracle failure), then the percent difference is calculated as 100%.
     */
    function getPercentDifference(
        uint x,
        uint y
    ) internal pure returns (uint256 percentDifference) {
        percentDifference = x * ONE / y;
        percentDifference = x > y ? percentDifference - ONE : ONE - percentDifference;
    }
}
