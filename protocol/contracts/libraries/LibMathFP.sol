/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";
/**
 * Based on the implementation found in: https://github.com/HQ20/contracts/blob/master/contracts/math/DecimalMath.sol
*/

library LibMathFP {
    using SafeMath for uint256;


    //binary search to find x within 10 subintervals
    /**
    for anyone here, does this function look like it makes sense to use first of all and could it be the cause of the opcode errors? its being used to find the index of the piecewise
     */
    //ranges has to be an ordered set
    function findIndexWithinSubinterval(uint256[10] calldata ranges, uint256 x, uint256 low, uint256 high) internal pure returns (uint256 mid) {
        // console.log();
        while (low<high) {
            mid = (low+high)/2;
            if(x <= ranges[mid]){
                low = mid - 1;
            } else if(x > ranges[mid]){
                high = mid - 1;
            } 
        }
    }

    event DebugCubic(uint256 x, uint256 term);

    //evaluate polynomial at x, with an option to 'integrateInstead' over the range of 0 - x
    function evaluateCubic(bool[4] memory sign, uint8[4] memory shift, uint256[4] memory term, uint256 x, uint256 amount, bool integrateInstead) internal pure returns (uint256) {
        uint256 y;
        uint256 yMinus;
        // if (!sign[0] && !sign[1] && !sign[2] && !sign[3]) {
        //     return 0;
        // }
        // if (x == 0) {
        //     return 0;
        // }
        for (uint8 i = 0; i < 4; i++) {
            if (integrateInstead) {
                //if integrate instead is selected, the polynomial is evaluated using polynomial integration rules 
                //integrate the inputted polynomial from value of x until k
                //seperate signs into two terms to prevent overflow or underflow during calculation 
                if (sign[i]) {
                    //combine all positive signs into  'y'
                    //terms are raised to the i+1th power and divided by i+1 because we are integrating
                    y += LibMathFP.muld((amount+x)**(i + 1) ,term[i] , shift[i]) / (i + 1);
                    y -= LibMathFP.muld(x**(i+1), term[i], shift[i]) / (i+1);
                    continue;
                } else {
                    //all negative sums are added to 'yMinus' 
                    yMinus += LibMathFP.muld((amount+x)**(i + 1) / (i + 1), term[i], shift[i]) / (i + 1);
                    yMinus -= LibMathFP.muld(x**(i+1), term[i], shift[i] / (i+1));
                    continue;
                }
            } else {
                //evaluate the polynomial at x
                
                 if (sign[i]) {
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
            // return yMinus.sub(y);
            return 0;
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
