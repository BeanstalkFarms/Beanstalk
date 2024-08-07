/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
/**
 * @title Oracle Helpers Library
 * @author brendan
 * @notice Contains functionalty common to multiple Oracle libraries.
 **/
library LibOracleHelpers {
    using LibRedundantMath256 for uint256;

    uint256 constant ONE = 1e18;

    /**
     * Gets the percent difference between two values with 18 decimal precision.
     * @dev If x == 0 (Such as in the case of Uniswap Oracle failure), then the percent difference is calculated as 100%.
     * Always use the bigger price as the denominator, thereby making sure that in whichever of the two cases explained in audit report (M-03),
     * i.e if x > y or not a fixed percentDifference is provided and this can then be accurately checked against protocol's set MAX_DIFFERENCE value.
     */
    function getPercentDifference(
        uint x,
        uint y
    ) internal pure returns (uint256 percentDifference) {
        percentDifference = x.mul(ONE).div(y);
        percentDifference = x > y ? percentDifference - ONE : ONE - percentDifference;
    }
}
