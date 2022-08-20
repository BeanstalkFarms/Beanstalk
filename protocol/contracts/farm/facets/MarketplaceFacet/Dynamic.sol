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

    // Evaluation of a PiecewiseFunction

    function evaluatePPoly(
        PPoly32 calldata f, 
        uint256 x, 
        uint256 pieceIndex, 
        uint256 evaluationDegree
    ) internal view returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;
        //only do x - rangeStart if x is greater than rangeStart, otherwise it will cause underflow
        x = x.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");

        while(currDegreeIndex <= evaluationDegree) {

            uint256 index = pieceIndex * 4 + currDegreeIndex;
            uint256 base = getPackedBase(f.bases[pieceIndex/8], (pieceIndex - ((pieceIndex/8)*8))*4 + currDegreeIndex);

            if(getPackedSign(f.signs, index)) {
                sumPositive += pow(x, currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base));
            } else {
                sumNegative += pow(x, currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base));
            }

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
    ) internal view returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;

        x1 = x1.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");
        x2 = x2.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");
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

    function getNumIntervals(uint256[32] calldata ranges) internal pure returns (uint256 numIntervals) {
        while(numIntervals < 32) {
            if(ranges[numIntervals] == 0 && numIntervals != 0) {
                break;
            }

            numIntervals++;
        }
        return numIntervals--;
    }

    function getPackedBase(uint256 packedBases, uint256 baseIndex) internal pure returns (uint8) {
        return uint8(packedBases >> ((32 - baseIndex - 1)*8)); //baseIndex is in the range 0 to 31
    }
    function getPackedSign(uint256 packedBools, uint256 boolIndex) internal pure returns (bool) {
        return ((packedBools >> boolIndex) & uint256(1) == 1); //boolIndex is in the range 0 to 255
    }
 
     //find the index of the interval containing x with the start of the interval being inclusive and the end of the interval being exclusive.
     // [inclusiveStart, exclusiveEnd)
    function findIndex(uint256[32] calldata arr, uint256 v, uint256 high) internal pure returns (uint256 index) {
        if(v < arr[0]) return 0;
        
        uint256 low = 0;
        
        while(low < high) {
            if(arr[low] == v) return low;
            else if(arr[low] > v) return low - 1;
            else low++;
        }

        return low-1;
    }
    // function findIndex(uint256[32] calldata array, uint256 value, uint256 maxIndex) internal pure returns (uint256) {
    //     int256 low;
    //     int256 high = int(maxIndex);
        
    //     while(low <= high){
            
    //         if(array[uint((high+low) >> 1)] < value) 
    //             low = ((high+low) >> 1) + 1;
    //         else 
    //             high = ((high+low) >> 1) - 1;
    //     }

    //     return uint256(low > 0 ? low - 1 : 0);
    // }

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