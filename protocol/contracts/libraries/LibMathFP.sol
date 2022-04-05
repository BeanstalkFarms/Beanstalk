/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * Based on the implementation found in: https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol
*/

library LibMathFP {
    using SafeMath for uint256;

    //binary search to find x within 10 subintervals
    function findIndexWithinSubinterval(uint256[10] calldata ranges, uint256 x) internal pure returns (uint256) {
        uint256 low;
        uint256 mid;
        uint256 high=9;

        while (low<=high) {
            mid = (low+high)/2;
            if(ranges[mid]<x){
                low = mid+1;
            }else if(ranges[mid]>x){
                high = mid-1;
            }else{
                return mid;
            }
        }
        
        return mid;
    }

    //evaluate polynomial at x, with an option to 'integrateInstead' over the range of 0 - x
    function evaluateCubic(bool[4] memory sign, uint8[4] memory shift, uint256[4] memory term, uint256 x, bool integrateInstead) internal pure returns (uint256) {
        
        uint256 y;
        uint256 yMinus;

        if (!sign[0] && !sign[1] && !sign[2] && !sign[3]) {
            return 0;
        }
        if (x == 0) {
            return 0;
        }
        for (uint8 i = 0; i < 4; i++) {
            if (integrateInstead) {
                //if integrate instead is selected, the polynomial is evaluated using polynomial integration rules 
                //integrate the inputted polynomial from 0 - x
                if (term[i] == 0) {
                    //if the constants is 0, skip the term
                    continue;
                }
                //seperate signs into two terms to prevent overflow or underflow during calculation 
                if (sign[i]) {
                    //combine all positive signs into  'y'
                    //terms are raised to the i+1th power and divided by i+1 because we are integrating
                    y += LibMathFP.muld(x**(i + 1), term[i] / (i + 1), shift[i]);
                    continue;
                } else {
                    //all negative sums are added to 'yMinus' 
                    yMinus += LibMathFP.muld(x**(i + 1), term[i] / (i + 1), shift[i]);
                    continue;
                }
            } else {
                //evaluate the polynomial at x
                if (term[i] == 0) {
                    continue;
                } else if (sign[i]) {
                    y += LibMathFP.muld(x**i, term[i], shift[i]);
                    continue;
                } else {
                    yMinus += LibMathFP.muld(x**i, term[i], shift[i]);
                    continue;
                }
            }
        }
        if (y > yMinus) {
            return y.sub(yMinus);
        } else {
            return yMinus.sub(y);
        }
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
    function muld(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(y).div(unit(decimals));
    }

    //@dev Divides x by y, assuming a 36 decimals fixed point
    function divd(uint256 x, uint256 y) internal pure returns (uint256) {
        return divd(x, y, 36);
    }

    //@dev Divides x by y, assuming a variable decimal fixed point
    function divd(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        return x.mul(unit(decimals)).div(y);
    }

    // divides x by y, rounding to the closest representable number
    // assumes 36 digit fixed point
    function divdr(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdr(x, y, 36);
    }

    // divides x by y, rounding to the closest representable number
    // variable fixed point
    function divdr(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 5) return z / 10 + 1;
        else return z / 10;
    }

    // @dev Divides x by y, rounding up to the closest representable number
    function divdrup(uint256 x, uint256 y) internal pure returns (uint256) {
        return divdrup(x, y, 36);
    }

    function divdrup(uint256 x, uint256 y, uint8 decimals) internal pure returns (uint256) {
        uint256 z = x.mul(unit(decimals + 1)).div(y);
        if (z % 10 > 0) return z / 10 + 1;
        else return z / 10;
    }
}
