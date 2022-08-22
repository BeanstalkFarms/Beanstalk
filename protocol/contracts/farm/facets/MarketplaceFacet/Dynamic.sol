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
    
    /**
        Example Piecewise to PPoly32 conversion: 

            Range(0, 1) -> Polynomial(0.25*x^3 + 25*x^2 + x + 1)
            Range(1, 2) -> Polynomial(0.0125*x^3 + 50*x^2 + x - 2)
            Range(2, Infinity) -> Polynomial(-1)
            
        Resulting PPoly32:

            ranges: [0, 1, 2, 0, 0, ... , 0]
            values: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, ... , 0]
            bases: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, ... , 0]
            signs: [true, true, true, true, false, true, true, true, false, false, false, ... , false]
        
    */
    struct PPoly32 {
        uint256[32] ranges; //The breakpoints for the piecewise. The last breakpoint in the array is the final interval for the polynomial, extending to infinity.
        uint256[128] values; // [c0_0,c1_0,c2_0,c3_0, ... , c0_31,c1_31,c2_31,c3_31] Contains the coefficients of the polynomial, concatenated according to their piecewise index. The first coefficient is the constant term, the second is the first term, etc.  
        uint256[4] bases; // [b0,b1,b2,b3] b0 contains the 8-bit bases for polynomials 0-7, b1 for polynomials 8-15, b2 for polynomials 16-23, b3 for polynomials 24-31.
        uint256 signs; // The first bit is the sign of c0_0, the second bit is the sign of c1_0, etc.
        PricingMode mode;
    }

    uint256 constant maxEvaluationDegree = 3;

    /**
    * @notice Computes a piecewise cubic polynomial at specified index.
    * @param f The piecewise function to integrate.
    * @param x The value at which to evaluate the polynomial.
    * @param pieceIndex The index of the function piece to evaluate.
    */
    function evaluatePPoly(
        PPoly32 calldata f, 
        uint256 x, 
        uint256 pieceIndex
    ) internal pure returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;
        //only do x - rangeStart if x is greater than rangeStart, otherwise it will cause underflow
        x = x.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");

        while(currDegreeIndex <= maxEvaluationDegree) {

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
 
    /**
    * @notice Computes the integral of a piecewise cubic polynomial at a single piecewise index.
    * @param f The piecewise function to integrate.
    * @param x1 The lower bound of the integral.
    * @param x2 The upper bound of the integral.
    * @param pieceIndex The index of the function piece to integrate.
    */
    function evaluatePPolyI(
        PPoly32 calldata f, 
        uint256 x1,
        uint256 x2,
        uint256 pieceIndex
    ) internal pure returns (uint256) {
        uint256 currDegreeIndex;
        uint256 sumPositive;
        uint256 sumNegative;

        x1 = x1.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");
        x2 = x2.sub(f.ranges[pieceIndex], "Marketplace: Not in function domain.");
        while(currDegreeIndex <= maxEvaluationDegree) {
            // to integrate from x1 to x2 we need to evaluate the expression
            // ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 ) - ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )

            uint256 index = pieceIndex * 4 + currDegreeIndex;
            uint256 base = getPackedBase(f.bases[pieceIndex / 8], (pieceIndex - ((pieceIndex/8)*8))*4 + currDegreeIndex);

            if (getPackedSign(f.signs, index)) {
                sumPositive += pow(x2, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex)); // add the term: ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 )
                
                sumPositive -= pow(x1, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex)); // subtract the term: ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )
            } else {
                sumNegative += pow(x2, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex));  // add the term: ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 )
            
                sumNegative -= pow(x1, 1 + currDegreeIndex)
                    .mul(f.values[index])
                    .div(pow(10, base).mul(1 + currDegreeIndex)); // subtract the term: ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )
            }
            currDegreeIndex++;
        }

        return sumPositive.sub(sumNegative);
    }

    /**
    * @notice Loads a calldata PPoly32 into memory.
    * @dev To be used when emitting function parameters
    */
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

    /**
    * @notice Creates a 'zero set' of PPoly32 values.
    * @dev To be used when hashing constant listings/orders to prevent hashing collisions
    */
    function createZeros() internal pure returns (uint256[32] memory ranges, uint256[128] memory values, uint256[4] memory bases) {
        for (uint256 i = 0; i < 128; i++) {
            values[i] = 0;
            if(i < 32) ranges[i] = 0;
            if(i < 4) bases[i] = 0;
        }

        return (ranges, values, bases);
    }

    /**
    * @notice Gets the number of relevant breakpoints in a PPoly32's ranges array.
    */
    function getNumIntervals(uint256[32] calldata ranges) internal pure returns (uint256 numIntervals) {
        while(numIntervals < 32) {
            if(ranges[numIntervals] == 0 && numIntervals != 0) {
                break;
            }
            numIntervals++;
        }
        return numIntervals--;
    }

    /**
    * @notice Retrieves the uint8 base at specified base index.
    * @dev 32 base indices are available per uint256. 
    * @param packedBases A uint256 created from the concatenation of up to 32 uint8 values.
    * @param baseIndex The index of the base to retrieve. Range: 0-31.
    */
    function getPackedBase(uint256 packedBases, uint256 baseIndex) internal pure returns (uint8) {
        return uint8(packedBases >> ((32 - baseIndex - 1)*8)); 
    }

    /**
    * @notice Retrieves the sign (bool value) at specified index.
    * @dev 256 sign indices are available per uint256. 1 bit is allocated per sign. 
    * @param packedBools A uint256 created from the concatenation of up to 256 boolean values.
    * @param boolIndex The index of the sign to retrieve. Range: 0-255.
    */
    function getPackedSign(uint256 packedBools, uint256 boolIndex) internal pure returns (bool) {
        return ((packedBools >> boolIndex) & uint256(1) == 1);
    }
 
     /**
    * @notice Searches for index of interval containing x
    * @dev [inclusiveStart, exclusiveEnd). -> If a value is at a breakpoint, it is considered to be in the next interval. 
    * @param arr Array of breakpoints from a PPoly32.
    * @param v The value to search for.
    * @param high The highest index of the array to search. Could be retrieved from getNumIntervals(arr) - 1.
    */
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