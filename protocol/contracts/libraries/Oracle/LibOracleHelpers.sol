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
     * Always use the bigger price as the denominator, thereby making sure that in whichever of the two cases explained in audit report (M-03),
     * i.e if x > y or not a fixed percentDifference is provided and this can then be accurately checked against protocol's set MAX_DIFFERENCE value.
     */
    function getPercentDifference(
        uint x,
        uint y
    ) internal pure returns (uint256 percentDifference) {
        if (x == y) {
            percentDifference = 0;
        } else if (x < y) {
            percentDifference = x.mul(ONE).div(y);
            percentDifference = ONE - percentDifference;
        } else {
            percentDifference = y.mul(ONE).div(x);
            percentDifference = ONE - percentDifference;
        }
        return percentDifference;
    }
}