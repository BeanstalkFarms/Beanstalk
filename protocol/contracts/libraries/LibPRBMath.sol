pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;


/**
 * @title LibPRBMath contains functionality to compute powers of 60.18 unsigned floating point to uint256
 * Solution taken from https://github.com/paulrberg/prb-math/blob/main/contracts/PRBMathUD60x18.sol
 * and adapted to Solidity 0.7.6
**/
library LibPRBMath {

    // /// @dev How many trailing decimals can be represented.
    uint256 internal constant LOG_SCALE = 1e18;
    uint256 internal constant LOG_HALF_SCALE = 5e17;

    // /// @dev Largest power of two divisor of SCALE.
    // uint256 internal constant SCALE_LPOTD = 262144;

    // /// @dev SCALE inverted mod 2^256.
    // uint256 internal constant SCALE_INVERSE =
    //     78156646155174841979727994598816262306175212592076161876661_508869554232690281;

    
    /// @dev How many trailing decimals can be represented.
    uint256 internal constant SCALE = 1e36;

     /// @dev Half the SCALE number.
    uint256 internal constant HALF_SCALE = 5e17;

    /// @dev Largest power of two divisor of SCALE.
    uint256 internal constant SCALE_LPOTD = 68719476736;

    /// @dev SCALE inverted mod 2^256.
    uint256 internal constant SCALE_INVERSE =
        24147664466589061293728112707504694672000531928996266765558539143717230155537;

    function powu(uint256 x, uint256 y) internal pure returns (uint256 result) {
        // Calculate the first iteration of the loop in advance.
        result = y & 1 > 0 ? x : SCALE;

        // Equivalent to "for(y /= 2; y > 0; y /= 2)" but faster.
        for (y >>= 1; y > 0; y >>= 1) {
            x = mulDivFixedPoint(x, x);

            // Equivalent to "y % 2 == 1" but faster.
            if (y & 1 > 0) {
                result = mulDivFixedPoint(result, x);
            }
        }
    }

    function mulDivFixedPoint(uint256 x, uint256 y) internal pure returns (uint256 result) {
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(x, y, not(0))
            prod0 := mul(x, y)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        if (prod1 >= SCALE) {
            revert("fixed point overflow");
        }

        uint256 remainder;
        uint256 roundUpUnit;
        assembly {
            remainder := mulmod(x, y, SCALE)
            roundUpUnit := gt(remainder, 499999999999999999)
        }

        if (prod1 == 0) {
            result = (prod0 / SCALE) + roundUpUnit;
            return result;
        }

        assembly {
            result := add(
                mul(
                    or(
                        div(sub(prod0, remainder), SCALE_LPOTD),
                        mul(sub(prod1, gt(remainder, prod0)), add(div(sub(0, SCALE_LPOTD), SCALE_LPOTD), 1))
                    ),
                    SCALE_INVERSE
                ),
                roundUpUnit
            )
        }
    }

    function mostSignificantBit(uint256 x) internal pure returns (uint256 msb) {
        if (x >= 2**128) {
            x >>= 128;
            msb += 128;
        }
        if (x >= 2**64) {
            x >>= 64;
            msb += 64;
        }
        if (x >= 2**32) {
            x >>= 32;
            msb += 32;
        }
        if (x >= 2**16) {
            x >>= 16;
            msb += 16;
        }
        if (x >= 2**8) {
            x >>= 8;
            msb += 8;
        }
        if (x >= 2**4) {
            x >>= 4;
            msb += 4;
        }
        if (x >= 2**2) {
            x >>= 2;
            msb += 2;
        }
        if (x >= 2**1) {
            // No need to shift x any more.
            msb += 1;
        }
    }

    function logBase2(uint256 x) internal pure returns (uint256 result) {
    if (x < LOG_SCALE) {
        revert("Log Input Too Small");
    }
    // Calculate the integer part of the logarithm and add it to the result and finally calculate y = x * 2^(-n).
    uint256 n = mostSignificantBit(x / LOG_SCALE);

    // The integer part of the logarithm as an unsigned 60.18-decimal fixed-point number. The operation can't overflow
    // because n is maximum 255 and SCALE is 1e18.
    result = n * LOG_SCALE;

    // This is y = x * 2^(-n).
    uint256 y = x >> n;

    // If y = 1, the fractional part is zero.
    if (y == LOG_SCALE) {
        return result;
    }

    // Calculate the fractional part via the iterative approximation.
    // The "delta >>= 1" part is equivalent to "delta /= 2", but shifting bits is faster.
    for (uint256 delta = LOG_HALF_SCALE; delta > 0; delta >>= 1) {
        y = (y * y) / LOG_SCALE;

        // Is y^2 > 2 and so in the range [2,4)?
        if (y >= 2 * LOG_SCALE) {
            // Add the 2^(-m) factor to the logarithm.
            result += delta;

            // Corresponds to z/2 on Wikipedia.
            y >>= 1;
        }
    }
    }
}