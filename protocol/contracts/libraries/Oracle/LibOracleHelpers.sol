/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
/**
 * @title Oracle Helpers Library
 * @author brendan
 * @notice Contains functionalty common to multiple Oracle libraries.
 **/
library LibOracleHelpers {
    using SafeMath for uint256;

    uint256 constant ONE = 1e18;

    /**
     * Gets the percent difference between two values with 18 decimal precision.
     * @dev If x == 0 (Such as in the case of Uniswap Oracle failure), then the percent difference is calculated as 100%.
     */
    function getPercentDifference(
        uint x,
        uint y
    ) internal pure returns (uint256 percentDifference) {
        percentDifference = x.mul(ONE).div(y);
        percentDifference = x > y ? percentDifference - ONE : ONE - percentDifference; // SafeMath unnecessary due to conditional check
    }
}
