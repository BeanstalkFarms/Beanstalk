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

    /**
        The polynomial's constant terms are split into: 1) constant * 10^base , 2) the base the constant is raised to and, 3) the sign of the coefficients.
        Example conversion to PiecewisePolynomial struct: 

            Range(0, 1) -> Polynomial(0.25*x^3 + 25*x^2 + x + 1)
            Range(1, 2) -> Polynomial(0.0125*x^3 + 50*x^2 + x - 2)
            Range(2, Infinity) -> Polynomial(-1)
            
        Resulting PiecewisePolynomial:

            breakpoints: [0, 1, 2, 0, 0, ... , 0]
            significands: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, ... , 0]
            (expanded) coefficient exponents: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, ... , 0]
            (expanded) signs: [true, true, true, true, false, true, true, true, false, false, false, ... , false]
        
    */

    struct PiecewisePolynomial_4 {
        uint256[4] breakpoints; //The breakpoints for the piecewise. The last breakpoint in the array is the final interval for the polynomial, extending to infinity.
        uint256[16] significands; // [c0_0,c1_0,c2_0,c3_0, ... , c0_31,c1_31,c2_31,c3_31] Contains the significands of the coefficients of the polynomial, concatenated according to their piecewise index. The first coefficient is the constant term, the second is the first term, etc.  
        uint256 packedExponents; // [b0,b1,b2,b3] b0 contains the 8-bit bases for polynomials 0-7, b1 for polynomials 8-15
        uint256 packedSigns; // The first bit is the sign of c0_0, the second bit is the sign of c1_0, etc.
    }

    struct PiecewisePolynomial_16 {
        uint256[16] breakpoints; //The breakpoints for the piecewise. The last breakpoint in the array is the final interval for the polynomial, extending to infinity.
        uint256[64] significands; // [c0_0,c1_0,c2_0,c3_0, ... , c0_31,c1_31,c2_31,c3_31] Contains the significands of the coefficients of the polynomial, concatenated according to their piecewise index. The first coefficient is the constant term, the second is the first term, etc.  
        uint256[2] packedExponents; // [b0,b1,b2,b3] b0 contains the 8-bit bases for polynomials 0-7, b1 for polynomials 8-15
        uint256 packedSigns; // The first bit is the sign of c0_0, the second bit is the sign of c1_0, etc.
    }

    struct PiecewisePolynomial_64 {
        uint256[64] breakpoints; //The breakpoints for the piecewise. The last breakpoint in the array is the final interval for the polynomial, extending to infinity.
        uint256[256] significands; // [c0_0,c1_0,c2_0,c3_0, ... , c0_31,c1_31,c2_31,c3_31] Contains the significands of the coefficients of the polynomial, concatenated according to their piecewise index. The first coefficient is the constant term, the second is the first term, etc.  
        uint256[8] packedExponents; // [b0,b1,b2,b3] b0 contains the 8-bit bases for polynomials 0-7, b1 for polynomials 8-15
        uint256 packedSigns; // The first bit is the sign of c0_0, the second bit is the sign of c1_0, etc.
    }

    uint256 constant MAX_DEGREE = 3;

    /**
    * @notice Computes a piecewise cubic polynomial at specified index.
    * @param significands The piecewise function to evaluate.
    * @param x The value at which to evaluate the polynomial.
    */
    function _evaluatePolynomial(
        uint256[4] memory significands,
        uint8[4] memory exponents,
        bool[4] memory signs,
        uint256 x
    ) internal pure returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;

        for(uint256 degree = 0; degree <= MAX_DEGREE; degree++) {
            if(signs[degree]) {
                positiveSum += pow(x, degree)
                    .mul(significands[degree])
                    .div(pow(10, exponents[degree]));
            } else {
                negativeSum += pow(x, degree)
                    .mul(significands[degree])
                    .div(pow(10, exponents[degree]));
            }
        }
        return positiveSum.sub(negativeSum);
    }
 
    /**
    * @notice Computes the integral of a piecewise cubic polynomial at a single piecewise index.
    * @param significands The piecewise function to integrate.
    * @param start The lower bound of the integral. Will likely overflow past 10e13.
    * @param end The upper bound of the integral. Will likely overflow past 10e13.
    */
    function _evaluatePolynomialIntegration(
        uint256[4] memory significands,
        uint8[4] memory exponents,
        bool[4] memory signs,
        uint256 start, //start of breakpoint is assumed to be subtracted
        uint256 end //start of breakpoint is assumed to be subtracted
    ) internal view returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;
        
        for(uint256 degree = 0; degree <= MAX_DEGREE; degree++) {

            if(signs[degree]) {
                //uint256 max value is 1e77 and the maximum value we're expecting to evaluate is 1e14. 
                //1e14^4 is 1e56, leaving (1e77 - 1e56) around 1e20 in room for the significand's precision, past that it overflows.
                //Accordingly, the variable floating point has been set to 10e20 in the interpolation code.
                positiveSum += pow(end, 1 + degree)
                    .mul(significands[degree])
                    .div(
                        pow(10, exponents[degree]).mul(1 + degree)
                    );

                positiveSum -= pow(start, 1 + degree)
                    .mul(significands[degree])
                    .div(
                        pow(10, exponents[degree]).mul(1 + degree)
                    );
            } else {
                negativeSum += pow(end, 1 + degree)
                    .mul(significands[degree])
                    .div(
                        pow(10, exponents[degree]).mul(1 + degree)
                    );

                negativeSum -= pow(end, 1 + degree)
                    .mul(significands[degree])
                    .div(
                        pow(10, exponents[degree]).mul(1 + degree)
                    );
            }
        }
        return positiveSum.sub(negativeSum);
    }
 
    /**
    * @notice Loads a calldata PiecewisePolynomial into memory.
    * @dev To be used when emitting function parameters
    */

    /**
    * @notice Gets the number of relevant breakpoints in a PiecewisePolynomial's breakpoints array.
    */

    function getNumPiecesFrom64(uint256[64] calldata breakpoints) internal pure returns (uint256 numPieces) {
        for(numPieces; numPieces < 64; numPieces++) {
            if(breakpoints[numPieces] == 0 && numPieces != 0) {
                break;
            }
        }
        return numPieces--;
    }

    function getNumPiecesFrom16(uint256[16] calldata breakpoints) internal pure returns (uint256 numPieces) {
        for(numPieces; numPieces < 16; numPieces++) {
            if(breakpoints[numPieces] == 0 && numPieces != 0) {
                break;
            }
        }
        return numPieces--;
    }

    function getNumPiecesFrom4(uint256[4] calldata breakpoints) internal pure returns (uint256 numPieces) {
        for(numPieces; numPieces < 4; numPieces++) {
            if(breakpoints[numPieces] == 0 && numPieces != 0) {
                break;
            }
        }
        return numPieces--;
    }

    /**
    * @notice Retrieves the uint8 base at specified base index.
    * @dev 32 base indices are available per uint256. 
    * @param packedExponents A uint256 created from the concatenation of up to 32 uint8 values.
    * @param piece The index of the piece to retrieve the base for.
    */
    function getPackedExponents(uint256 packedExponents, uint256 piece) internal view returns (uint8[4] memory) {
        uint8[4] memory exponents;
        uint256 relativeBaseIndex = (piece % 8)*4; //get the index of the base in the relevant uint256
        // console.log(packedExponents, piece);
        exponents[0] = uint8(packedExponents >> ((32 - relativeBaseIndex - 1)*8));
        exponents[1] = uint8(packedExponents >> ((32 - (relativeBaseIndex + 1) - 1)*8));
        exponents[2] = uint8(packedExponents >> ((32 - (relativeBaseIndex + 2) - 1)*8));
        exponents[3] = uint8(packedExponents >> ((32 - (relativeBaseIndex + 3) - 1)*8));
        // console.log(exponents[0], exponents[1], exponents[2], exponents[3]);
        return exponents; 
    }

    /**
    * @notice Retrieves the sign (bool value) at specified index.
    * @dev 256 sign indices are available per uint256. 1 bit is allocated per sign. 
    * @param packedBools A uint256 created from the concatenation of up to 256 boolean values.
    * @param piece The index of the piece to retrieve the sign for.
    */
    function getPackedSigns(uint256 packedBools, uint256 piece) internal pure returns (bool[4] memory) {
        bool[4] memory signs;
        signs[0] = ((packedBools >> (piece*4 )) & uint256(1) == 1);
        signs[1] = ((packedBools >> (piece*4 + 1)) & uint256(1) == 1);
        signs[2] = ((packedBools >> (piece*4 + 2)) & uint256(1) == 1);
        signs[3] = ((packedBools >> (piece*4 + 3)) & uint256(1) == 1);
        return signs;
    }
 
     /**
    * @notice Searches for index of interval containing x
    * @dev [inclusiveStart, exclusiveEnd). -> If a value is at a breakpoint, it is considered to be in the next interval. 
    * @param breakpoints Array of breakpoints from a PiecewisePolynomial.
    * @param value The value to search for.
    * @param high The highest index of the array to search. Could be retrieved from getNumPieces(arr) - 1.
    */
    function findPieceIndexFrom64(uint256[64] calldata breakpoints, uint256 value, uint256 high) internal pure returns (uint256 index) {
        if(value < breakpoints[0]) return 0;
        
        uint256 low = 0;
        
        while(low < high) {
            if(breakpoints[low] == value) return low;
            else if(breakpoints[low] > value) return low - 1;
            else low++;
        }

        return low - 1;
    }

    function findPieceIndexFrom16(uint256[16] calldata breakpoints, uint256 value, uint256 high) internal pure returns (uint256 index) {
        if(value < breakpoints[0]) return 0;
        
        uint256 low = 0;
        
        while(low < high) {
            if(breakpoints[low] == value) return low;
            else if(breakpoints[low] > value) return low - 1;
            else low++;
        }

        return low - 1;
    }

    function findPieceIndexFrom4(uint256[4] calldata breakpoints, uint256 value, uint256 high) internal pure returns (uint256 index) {
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