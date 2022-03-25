pragma solidity ^0.7.6;
import "@openzeppelin/contracts/math/SafeMath.sol";

// https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol

library MathFP {
    using SafeMath for uint256;
    uint256 constant maxUintCons = 2**256 - 1;

    struct PiecewiseFormula {
        uint256[10] subIntervalIndex;
        uint256[9] intervalIntegrations;
        uint240[10] constantsDegreeZero;
        uint8[10] shiftsDegreeZero;
        bool[10] boolsDegreeZero;
        uint240[10] constantsDegreeOne;
        uint8[10] shiftsDegreeOne;
        bool[10] boolsDegreeOne;
        uint240[10] constantsDegreeTwo;
        uint8[10] shiftsDegreeTwo;
        bool[10] boolsDegreeTwo;
        uint240[10] constantsDegreeThree;
        uint8[10] shiftsDegreeThree;
        bool[10] boolsDegreeThree; //13 terms
    }

    // function evaluatePCubicP(PiecewiseFormula memory f, uint256 x, uint256 amount) internal returns (uint256) {
    //     uint256 y;
    //     uint256 i;
    //     uint256 ik;
    //     // find definite integral of the piecewise between x and x+amount
    //     i = findIndexWithinSubinterval(f.subIntervalIndex, x);
    //     ik = findIndexWithinSubinterval(f.subIntervalIndex, x+amount);
    //     uint8 diff = ik-i;
    //     if(diff == 0){

    //     } if (diff == 1) {

    //     }
    //     else if (diff > 1)
    //     // if i and ik are different, we need to sum the whole
    //     y = evaluatePCubic(x, f.subIntervalIndex[i], [f.constantsDegreeZero[i], f.constantsDegreeOne[i], f.constantsDegreeTwo[i], f.constantsDegreeThree[i]],
    //         [f.shiftsDegreeZero[i], f.shiftsDegreeOne[i], f.shiftsDegreeTwo[i], f.shiftsDegreeThree[i]],
    //         [f.boolsDegreeZero[i], f.boolsDegreeOne[i], f.boolsDegreeTwo[i], f.boolsDegreeThree[i]]);

    //     return y;
    // }

    function findIndexWithinSubinterval(uint256[10] memory values, uint256 x)
        internal
        pure
        returns (uint256)
    {
        //array of values must be ordered
        uint256 low = 0;
        uint256 mid = values.length - 1;
        uint256 high = mid;
        while (low <= mid) {
            mid = (low + mid) / 2;
            if (values[mid] < x) {
                low = mid + 1;
            } else if (values[mid] > x) {
                high = mid - 1;
            }
        }

        if (high > 0) {
            return high;
        } else {
            return 0;
        }
    }

    // function evaluateDefiniteICubic

    function evaluateDefiniteIntegralCubic(
        uint256 startIndex,
        uint256 endIndex,
        uint256 k,
        bool endValue,
        uint240[4] memory constants,
        uint8[4] memory shifts,
        bool[4] memory bools
    ) internal returns (uint256) {
        // uint8 counter = 5;

        uint256 result;
        uint256 termValue1;
        uint256 termValue2;
        uint256 yReduction;
        uint256 lastTermValue;
        for (uint8 i = 0; i < 4; i++) {
            if (constants[i] == 0) {
                continue;
            }
            termValue1 = MathFP.muld(
                (startIndex - k)**(i + 1),
                constants[i] / (i + 1),
                shifts[i]
            );

            if (!endValue) {
                termValue2 = MathFP.muld(
                    (endIndex - k + (endIndex / 10000000))**(i + 1),
                    constants[i] / (i + 1),
                    shifts[i]
                );
            } else {
                termValue2 = MathFP.muld(
                    (endIndex - k)**(i + 1),
                    constants[i] / (i + 1),
                    shifts[i]
                );
            }
            if (bools[i]) {
                result += termValue2 - termValue1;
                if (lastTermValue != 0) {
                    if (result > lastTermValue) {
                        result -= lastTermValue;
                        lastTermValue = 0;
                    }
                }
                continue;
            } else {
                if (result > (termValue2 - termValue1)) {
                    result -= termValue2 - termValue1;
                } else {
                    lastTermValue = (termValue2 - termValue1);
                }
                continue;
            }
        }
        return result;
    }

    function evaluatePCubic(
        uint256 x,
        uint256 k,
        uint240[4] memory constants,
        uint8[4] memory shifts,
        bool[4] memory bools
    ) internal returns (uint256) {
        //may need to solve degree 4 problems for integrating

        uint8 counter = 5;
        uint256 y;
        uint256 termValue;
        for (uint8 i = 0; i < 4; i++) {
            if (constants[i] == 0) {
                continue;
            }
            termValue = MathFP.muld((x - k)**i, constants[i], shifts[i]);
            if (bools[i]) {
                y += termValue;
                if (counter != 5) {
                    termValue = MathFP.muld(
                        (x - k)**counter,
                        constants[counter],
                        shifts[counter]
                    );
                    if (y > termValue) {
                        y -= termValue;
                        counter = 5;
                    }
                }
                continue;
            } else {
                if (y > termValue) {
                    y -= termValue;
                } else {
                    if (counter == 5) {
                        counter = i;
                    }
                }
                continue;
            }
        }
        return y;
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
