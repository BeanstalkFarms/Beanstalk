// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @author Publius, funderbrker
 * @title LibRedundantMath variation of Open Zeppelin's Safe Math library for int96.
 * @dev Newly developed code should not use this library. Instead opt for native arithmetic operators.
 *
 * This library replicates the behavior of 0.7 SafeMath libraries for 0.8. Safe math is unnecessary
 * in solidity ^0.8, so the functionality here is mostly redundant with default arithmetic
 * operators. However, manually updating over 1000 math operations throughout the repo was
 * deemed too likely to introduce logic errors. Instead, the original syntax was kept
 * and the underlying logic updated to be 0.8 appropriate.
 **/
library LibRedundantMathSigned96 {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(int96 a, int96 b) internal pure returns (int96) {
        return a + b;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(int96 a, int96 b) internal pure returns (int96) {
        return a - b;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(int96 a, int96 b) internal pure returns (int96) {
        return a * b;
    }

    /**
     * @dev Returns the integer division of two unsigned integers, reverting on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(int96 a, int96 b) internal pure returns (int96) {
        return a / b;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * reverting when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(int96 a, int96 b) internal pure returns (int96) {
        return a % b;
    }
}
