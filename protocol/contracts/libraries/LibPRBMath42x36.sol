pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title LibPRBMath contains functionality to compute powers of 42.36 unsigned floating point to uint256
 * Solution taken from https://github.com/paulrberg/prb-math/blob/main/contracts/PRBMathUD60x18.sol
 * and adapted to Solidity 0.7.6
 **/
library LibPRBMath42x36 {
    // /// @dev How many trailing decimals can be represented.
    // uint256 internal constant SCALE = 1e18;

    // /// @dev Largest power of two divisor of SCALE.
    // uint256 internal constant SCALE_LPOTD = 262144;

    // /// @dev SCALE inverted mod 2^256.
    // uint256 internal constant SCALE_INVERSE =
    //     78156646155174841979727994598816262306175212592076161876661_508869554232690281;

    /// @dev How many trailing decimals can be represented.
    uint256 internal constant SCALE = 1e36;

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

    function mulDivFixedPoint(
        uint256 x,
        uint256 y
    ) internal pure returns (uint256 result) {
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
                        mul(
                            sub(prod1, gt(remainder, prod0)),
                            add(div(sub(0, SCALE_LPOTD), SCALE_LPOTD), 1)
                        )
                    ),
                    SCALE_INVERSE
                ),
                roundUpUnit
            )
        }
    }
}
