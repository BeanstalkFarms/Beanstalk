pragma solidity ^0.7.6;
import "@openzeppelin/contracts/math/SafeMath.sol";

// https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol

library MathFP {
    using SafeMath for uint256;
    uint256 constant maxUintCons = 2**256 - 1;

    struct PiecewiseFormula {
        uint256[10] subIntervalIndex;
        uint256[40] constants;
        uint8[40] shifts;
        bool[40] bools;
        // only need subIntervalIndex, constants[40], shifts[40], bools[40]
    }

    // struct Polynomial {
    //     uint240 constantd0;
    //     uint240 constantd1;
    //     uint240 constantd2;
    //     uint240 constantd3;
    //     uint8 shiftd0;
    //     uint8 shiftd1;
    //     uint8 shiftd2;
    //     uint8 shiftd3;
    //     bool signd0;
    //     bool signd1;
    //     bool signd2;
    //     bool signd3;
    // }

    //probably shouldnt be done on chain? we coiuld just check it instead
    function findIndexWithinSubinterval(uint256[10] memory ranges, uint256 x)
        internal
        pure
        returns (uint256)
    {
        //array of values must be ordered
        uint256 low = 0;
        uint256 mid = ranges.length - 1;
        uint256 high = mid;
        while (low <= mid) {
            mid = (low + mid) / 2;
            if (ranges[mid] < x) {
                low = mid + 1;
            } else if (ranges[mid] > x) {
                high = mid - 1;
            }
        }

        return high;
    }

    function integrateCubic(
        bool[4] memory sign,
        uint8[4] memory shift,
        uint256[4] memory term,
        uint256 k
    ) internal pure returns (uint256) {
        //this function evaluates the area under curve of a cubic polynomial in the bounds of (0,k)

        uint256 y;
        uint256 yMinus;
        if (!sign[0] && !sign[1] && !sign[2] && !sign[3]) {
            return 0;
        }

        if (sign[0]) {
            y += MathFP.muld(k, term[0], shift[0]);
        } else {
            yMinus += MathFP.muld(k, term[0], shift[0]);
        }

        if (sign[1]) {
            y += MathFP.muld(k**2, term[1] / 2, shift[1]);
        } else {
            yMinus += MathFP.muld(k**2, term[1] / 2, shift[1]);
        }

        if (sign[2]) {
            y += MathFP.muld(k**3, term[2] / 3, shift[2]);
        } else {
            yMinus += MathFP.muld(k**3, term[2] / 3, shift[2]);
        }

        if (sign[3]) {
            y += MathFP.muld(k**4, term[3] / 4, shift[3]);
        } else {
            yMinus += MathFP.muld(k**4, term[3] / 4, shift[3]);
        }

        return y - yMinus;
    }

    function evaluateCubic(
        bool[4] memory sign,
        uint8[4] memory shift,
        uint256[4] memory term,
        uint256 x
    ) internal pure returns (uint256) {
        uint256 y;
        uint256 yMinus;
        if (!sign[0] && !sign[1] && !sign[2] && !sign[3]) {
            return 0;
        }

        if (sign[0]) {
            y += MathFP.muld(1, term[0], shift[0]);
        } else {
            yMinus += MathFP.muld(1, term[0], shift[0]);
        }

        if (sign[1]) {
            y += MathFP.muld(x, term[1], shift[1]);
        } else {
            yMinus += MathFP.muld(x, term[1], shift[1]);
        }

        if (sign[2]) {
            y += MathFP.muld(x**2, term[2], shift[2]);
        } else {
            yMinus += MathFP.muld(x**2, term[2], shift[2]);
        }

        if (sign[3]) {
            y += MathFP.muld(x**3, term[3], shift[3]);
        } else {
            yMinus += MathFP.muld(x**3, term[3], shift[3]);
        }

        return y - yMinus;
    }

    //returns '1' in FP representation
    function unit(uint8 decimals) internal pure returns (uint256) {
        require(decimals <= 77, "Maximum of 77 decimals.");
        return 10**uint256(decimals);
    }

    // adds x and y assuming they are both fixed point
    function addd(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.add(y);
    }

    //substract assuming both are fixed point
    function subd(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.sub(y);
    }

    //@dev Multiplies x and y, assuming 36 decimals fixed point
    function muld(uint256 x, uint256 y) internal pure returns (uint256) {
        return muld(x, y, 36);
    }

    //@dev Multiplies x and y, assuming a variable decimal fixed point
    function muld(
        uint256 x,
        uint256 y,
        uint8 decimals
    ) internal pure returns (uint256) {
        return x.mul(y).div(unit(decimals));
    }

    //@dev Divides x by y, assuming a 36 decimals fixed point
    function divd(uint256 x, uint256 y) internal pure returns (uint256) {
        return divd(x, y, 36);
    }

    //@dev Divides x by y, assuming a variable decimal fixed point
    function divd(
        uint256 x,
        uint256 y,
        uint8 decimals
    ) internal pure returns (uint256) {
        return x.mul(unit(decimals)).div(y);
    }

    // divides x by y, rounding to the closest representable number
    // assumes 36 digit fixed point
    function divdr(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdr(x, y, 36);
    }

    // divides x by y, rounding to the closest representable number
    // variable fixed point
    function divdr(
        uint256 x,
        uint256 y,
        uint8 decimals
    ) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 5) return z / 10 + 1;
        else return z / 10;
    }

    // @dev Divides x by y, rounding up to the closest representable number
    function divdrup(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdrup(x, y, 36);
    }

    function divdrup(
        uint256 x,
        uint256 y,
        uint8 decimals
    ) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 0) return z / 10 + 1;
        else return z / 10;
    }
}
