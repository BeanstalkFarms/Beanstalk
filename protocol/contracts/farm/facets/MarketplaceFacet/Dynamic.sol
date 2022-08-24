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

    enum EvaluationMode {
        Fixed,
        Dynamic
    }
    /**
        The polynomial's constant terms are split into: 1) constant * 10^base , 2) the base the constant is raised to and, 3) the sign of the constants.
        Example conversion to PiecewisePolynomial struct: 

            Range(0, 1) -> Polynomial(0.25*x^3 + 25*x^2 + x + 1)
            Range(1, 2) -> Polynomial(0.0125*x^3 + 50*x^2 + x - 2)
            Range(2, Infinity) -> Polynomial(-1)
            
        Resulting PiecewisePolynomial:

            breakpoints: [0, 1, 2, 0, 0, ... , 0]
            constants: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, ... , 0]
            (expanded) bases: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, ... , 0]
            (expanded) signs: [true, true, true, true, false, true, true, true, false, false, false, ... , false]
        
    */
    
    //
    struct PiecewisePolynomial {
        uint256[16] breakpoints; //The breakpoints for the piecewise. The last breakpoint in the array is the final interval for the polynomial, extending to infinity.
        uint256[64] constants; // [c0_0,c1_0,c2_0,c3_0, ... , c0_31,c1_31,c2_31,c3_31] Contains the coefficients of the polynomial, concatenated according to their piecewise index. The first coefficient is the constant term, the second is the first term, etc.  
        uint256[2] packedBases; // [b0,b1,b2,b3] b0 contains the 8-bit bases for polynomials 0-7, b1 for polynomials 8-15
        uint256 packedSigns; // The first bit is the sign of c0_0, the second bit is the sign of c1_0, etc.
        EvaluationMode mode; // The pricing mode.
    }

    uint256 constant MAX_DEGREE = 3;

    /**
    * @notice Computes a piecewise cubic polynomial at specified index.
    * @param f The piecewise function to integrate.
    * @param x The value at which to evaluate the polynomial.
    * @param piece The index of the function piece to evaluate.
    */
    function evaluatePolynomial(
        PiecewisePolynomial calldata f, 
        uint256 x, 
        uint256 piece
    ) internal pure returns (uint256) {
        uint256 degree;
        uint256 positiveSum;
        uint256 negativeSum;

        //only do x - rangeStart if x is greater than rangeStart, otherwise it will cause underflow
        x = x.sub(f.breakpoints[piece], "Marketplace: Not in function domain.");

        while(degree <= MAX_DEGREE) {

            uint256 index = piece * 4 + degree;

            if(getPackedSign(f.packedSigns, piece, degree)) {
                positiveSum += pow(x, degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree))
                    );
            } else {
                negativeSum += pow(x, degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree))
                    );
            }
            degree++;
        }

        return positiveSum.sub(negativeSum);
    }
 
    /**
    * @notice Computes the integral of a piecewise cubic polynomial at a single piecewise index.
    * @param f The piecewise function to integrate.
    * @param start The lower bound of the integral.
    * @param end The upper bound of the integral.
    * @param piece The index of the function piece to integrate.
    */
    function evaluatePolynomialIntegration(
        PiecewisePolynomial calldata f, 
        uint256 start,
        uint256 end,
        uint256 piece
    ) internal pure returns (uint256) {
        uint256 degree;
        uint256 positiveSum;
        uint256 negativeSum;

        start = start.sub(f.breakpoints[piece], "Marketplace: Not in function domain.");
        end = end.sub(f.breakpoints[piece], "Marketplace: Not in function domain.");

        while(degree <= MAX_DEGREE) {
            // to integrate from x1 to x2 we need to evaluate the expression
            // ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 ) - ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )

            uint256 index = piece * 4 + degree;

            if (getPackedSign(f.packedSigns, piece, degree)) {
                positiveSum += pow(end, 1 + degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree)).mul(1 + degree)
                    ); 
                
                positiveSum -= pow(start, 1 + degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree)).mul(1 + degree)
                    ); 
            } else {
                negativeSum += pow(end, 1 + degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree)).mul(1 + degree)
                    ); 
            
                negativeSum -= pow(start, 1 + degree)
                    .mul(f.constants[index])
                    .div(
                        pow(10, getPackedBase(f.packedBases, piece, degree)).mul(1 + degree)
                    ); 
            }
            degree++;
        }

        return positiveSum.sub(negativeSum);
    }

    /**
    * @notice Loads a calldata PPoly32 into memory.
    * @dev To be used when emitting function parameters
    */

    function loadArraysToMemory(uint256[16] calldata _breakpoints, uint256[64] memory _constants) internal pure returns (uint256[16] memory, uint256[64] memory) {
        uint256[16] memory breakpoints = _breakpoints;
        uint256[64] memory constants = _constants;

        return (breakpoints, constants);
    }

    /**
    * @notice Gets the number of relevant breakpoints in a PPoly32's ranges array.
    */
   
    function getNumPieces(uint256[16] calldata ranges) internal pure returns (uint256 numPieces) {
        while(numPieces < 16) {
            if(ranges[numPieces] == 0 && numPieces != 0) {
                break;
            }
            numPieces++;
        }
        return numPieces--;
    }

    /**
    * @notice Retrieves the uint8 base at specified base index.
    * @dev 32 base indices are available per uint256. 
    * @param packedBases A uint256 created from the concatenation of up to 32 uint8 values.
    * @param piece The index of the piece to retrieve the base for.
    * @param degree The degree of the constant term to retrieve the base for. 
    */
    function getPackedBase(uint256[2] calldata packedBases, uint256 piece, uint256 degree) internal pure returns (uint8) {
        uint256 packedBase = packedBases[piece/ 8]; //get the relevant uint256 from packedBases
        uint256 relativeBaseIndex = (piece - ((piece/8)*8))*4 + degree; //get the index of the base in the relevant uint256
        return uint8(packedBase >> ((32 - relativeBaseIndex - 1)*8)); 
    }

    /**
    * @notice Retrieves the sign (bool value) at specified index.
    * @dev 256 sign indices are available per uint256. 1 bit is allocated per sign. 
    * @param packedBools A uint256 created from the concatenation of up to 256 boolean values.
    * @param piece The index of the piece to retrieve the sign for.
    * @param degree The degree of the constant term to retrieve the sign for. 
    */
    function getPackedSign(uint256 packedBools, uint256 piece, uint256 degree) internal pure returns (bool) {
        return ((packedBools >> (piece*4 + degree)) & uint256(1) == 1);
    }
 
     /**
    * @notice Searches for index of interval containing x
    * @dev [inclusiveStart, exclusiveEnd). -> If a value is at a breakpoint, it is considered to be in the next interval. 
    * @param breakpoints Array of breakpoints from a PiecewisePolynomial.
    * @param value The value to search for.
    * @param high The highest index of the array to search. Could be retrieved from getNumPieces(arr) - 1.
    */
    function findPieceIndex(uint256[16] calldata breakpoints, uint256 value, uint256 high) internal pure returns (uint256 index) {
        if(value < breakpoints[0]) return 0;
        
        uint256 low = 0;
        
        while(low < high) {
            if(breakpoints[low] == value) return low;
            else if(breakpoints[low] > value) return low - 1;
            else low++;
        }

        return low - 1;
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