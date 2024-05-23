// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {PRBMath} from "@prb/math/contracts/PRBMath.sol";

/**
 * @title LibPRBMathRoundable wraps PRB Math allow upwards rounding of 60.18 unsigned floating point mulDiv operations.
 * https://github.com/PaulRBerg/prb-math/releases/tag/v2.5.0
 **/
library LibPRBMathRoundable {
    enum Rounding {
        Down, // Toward negative infinity
        Up, // Toward infinity
        Zero // Toward zero
    }

    /**
     * @notice Calculates x * y / denominator with full precision, following the selected rounding direction.
     */
    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 denominator,
        Rounding rounding
    ) internal pure returns (uint256) {
        uint256 result = PRBMath.mulDiv(x, y, denominator);
        if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
        return result;
    }
}
