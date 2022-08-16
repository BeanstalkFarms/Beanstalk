/**
 * SPDX-License-Identifier: MIT
 **/

 pragma solidity =0.7.6;
 pragma experimental ABIEncoderV2;
 
 import "../../../libraries/Token/LibTransfer.sol";
 import "./PodTransfer.sol";
 import "hardhat/console.sol";
 
 
 /* 
 * @author: Malteasy
 * @title: Dynamic Pricing
 */
 
 contract Dynamic is PodTransfer { 

    using SafeMath for uint256;

    enum PricingMode {
        CONSTANT,
        DYNAMIC
    }

    //polynomials are evaluated at a maximum order of 3 (cubic evaluation)
    //A piecewise polynomial containing up to 32 polynomials and their corresponding ranges

    struct PPoly32 {
        uint256[32] ranges;
        uint256[128] values;
        uint256[4] bases; //32 8-bit bases fit into each 256 bit word, so 1 + maxPolynomialDegree words are needed for 32 
        uint256 signs; 
        PricingMode mode;
    }

    // struct PPoly64 {
    //     uint256[64] ranges;
    //     uint256[256] values;
    //     uint256[8] bases; 
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // struct PPoly16 {
    //     uint256[16] ranges;
    //     uint256[64] values;
    //     uint256[2] bases;
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // struct PPoly8 {
    //     uint256[8] ranges;
    //     uint256[32] values;
    //     uint256 bases; 
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // struct PPoly4 {
    //     uint256[4] ranges;
    //     uint256[16] values;
    //     uint256 bases; 
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // struct PPoly2 {
    //     uint256[2] ranges;
    //     uint256[8] values;
    //     uint256 bases; 
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // struct PPoly1 {
    //     uint256 ranges;
    //     uint256[4] values;
    //     uint256 bases; 
    //     uint256 signs; 
    //     PricingMode mode;
    // }

    // Evaluation of a PiecewiseFunction

    function evaluatePPoly(
        PPoly32 calldata f, 
        uint256 x, 
        uint256 pieceIndex, 
        uint256 evaluationDegree
    ) internal pure returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;
        //only do x - rangeStart if x is greater than rangeStart, otherwise it will cause underflow
        if(x >= f.ranges[pieceIndex]) {
            x -= f.ranges[pieceIndex];
        }

        while(currDegreeIndex <= evaluationDegree) {
            // evaluate in the form v3(x-k)^3 + v2(x-k)^2 + v1(x-k) + v0
            // console.log(pieceIndex);
            uint256 index = pieceIndex * 4 + currDegreeIndex;
            uint256 base = getPackedBase(f.bases[pieceIndex/8], (pieceIndex - ((pieceIndex/8)*8))*4 + currDegreeIndex);
            // console.log(f.values[index], getPackedSign(f.signs, index), base, x);
            if(getPackedSign(f.signs, index)) {
                sumPositive += pow(x, currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base));
            } else {
                sumNegative += pow(x, currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base));
            }
            // console.log(sumPositive, sumNegative);
            currDegreeIndex++;
        }

        return sumPositive.sub(sumNegative);
    }
 
     //Piecewise Integration
     /**
     * @dev Calculates the integral of a piecewise function.
     *
     * 
     */
     function evaluatePPolyI(
        PPoly32 calldata f, 
        uint256 x1, 
        uint256 x2, 
        uint256 pieceIndex, 
        uint256 evaluationDegree
    ) internal pure returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;

        if(x1 >= f.ranges[pieceIndex] && x2 >= f.ranges[pieceIndex]) {
            x1 -= f.ranges[pieceIndex];
            x2 -= f.ranges[pieceIndex];
        }

        while(currDegreeIndex <= evaluationDegree) {
            // to integrate from x1 to x2 we need to evaluate the expression
            // ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 ) - ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )
            uint256 index = pieceIndex * 4 + currDegreeIndex;
            uint256 base = getPackedBase(f.bases[pieceIndex / 8], (pieceIndex - ((pieceIndex/8)*8))*4 + currDegreeIndex);

            if (getPackedSign(f.signs, index)) {
                sumPositive += pow(x2, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex));
                
                sumPositive -= pow(x1, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex));
            } else {
                sumNegative += pow(x2, 1 + currDegreeIndex)
                .mul(f.values[index])
                .div(pow(10, base).mul(1 + currDegreeIndex));
            
                sumNegative -= pow(x1, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex));
            }

            currDegreeIndex++;
        }
        return sumPositive.sub(sumNegative);
     }

    function toMemory(PPoly32 calldata f) internal pure returns (PPoly32 memory) {
        uint256[32] memory ranges;
        uint256[128] memory values;
        uint256[4] memory bases;
        for(uint256 i = 0; i < 128; i++){
            values[i] = f.values[i];
            if(i < 4) bases[i] = f.bases[i];
            if(i < 32) ranges[i] = f.ranges[i];
        }
        return PPoly32(ranges, values, bases, f.signs, f.mode);
    }

    function createZeros() internal pure returns (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) {
        for (uint256 i = 0; i < 128; i++) {
            values[i] = 0;
            if(i < 32) ranges[i] = 0;
            if(i < 4) bases[i] = 0;
        }
        return (ranges, values, bases);
    }

    function getMaxPieceIndex(uint256[32] calldata ranges) internal pure returns (uint256 maxIndex) {
        while(maxIndex < 32) {
            if(ranges[maxIndex] == 0 && maxIndex != 0) {
                break;
            }
            maxIndex++;
        }

        // console.log("max index: ");
        // console.log(maxIndex--);
        return maxIndex--;
    }

    function getPackedBase(uint256 packedBases, uint256 baseIndex) internal pure returns (uint8) {
        //baseIndex is in the range 0 to 31
        return uint8(packedBases >> ((32 - baseIndex - 1)*8));
    }
    function getPackedSign(uint256 packedBools, uint256 boolIndex) internal pure returns (bool) {
        //boolIndex is in the range 0 to 255
        return ((packedBools >> boolIndex) & uint256(1) == 1);
    }
 
    //Function degree of a polynomial at a given pieceIndex
     function getDegree(PPoly32 calldata f, uint256 pieceIndex) internal pure returns (uint256 degree) {
        degree = 3;
         while(f.values[pieceIndex*4 + degree] == 0) {
            degree--;
         }
    }
 
     //find the index of the interval containing x with the start of the interval being inclusive and the end of the interval being exclusive.
     // [inclusiveStart, exclusiveEnd)
    function findIndex(uint256[32] calldata array, uint256 value, uint256 maxIndex) internal pure returns (uint256) {
        int256 low;
        int256 high = int(maxIndex);
        int256 mid;

        if(value == 0) 
            return 0;
        
        while(low <= high){

            mid = (high+low) / 2;

            if(array[uint(mid)] < value) 
                low = mid + 1;
            else 
                high = mid - 1;
        }

        return uint256(low);
    }

    //a safe function to take base to the power of exp.
    function pow(uint256 base, uint256 exponent) internal pure returns (uint256) {
        if(exponent == 0) 
            return 1;
            
        else if(exponent == 1) 
            return base; 

        else if(base == 0 && exponent != 0) 
            return 0;

        else {
            uint256 z = base;
            for(uint256 i = 1; i < exponent; i++) 
                z = z.mul(base);
            return z;
        }
    }
 }