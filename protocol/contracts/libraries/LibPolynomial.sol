/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
 
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";
 
 
 /* 
 * @author: Malteasy
 * @title: Polynomial Pricing
 */
 
library LibPolynomial { 

    using SafeMath for uint256;

    /**
        The polynomial's constant terms are split into: 1) constant * 10^exponent , 2) the exponent the constant is raised to in base 10 and, 3) the sign of the coefficients.
        Example conversion to Piecewise struct: 

            Range(0, 1) -> Polynomial(0.25*x^3 + 25*x^2 + x + 1)
            Range(1, 2) -> Polynomial(0.0125*x^3 + 50*x^2 + x - 2)
            Range(2, Infinity) -> Polynomial(-1)
            
        Resulting Piecewise:

            breakpoints: [0, 1, 2, 0, 0, ... , 0]
            significands: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, ... , 0]
            (expanded) coefficient exponents: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, ... , 0]
            (expanded) signs: [true, true, true, true, false, true, true, true, false, false, false, ... , false]
        
    */

    enum PriceType {
        Fixed,
        Dynamic
    }

    uint256 constant MAX_DEGREE = 3;

    /**
    * @notice Computes a cubic polynomial.
    * @param significands The numerators of the polynomial's coefficients (ordered by degree).
    * @param exponents Each significand is divided by 10^x where x is the exponent of that significand (ordered by degree).
    * @param signs The signs of the coefficient terms (ordered by degree).
    * @param x The value to be evaluated at.
    */
    function evaluatePolynomial(
        uint256[4] memory significands,
        uint8[4] memory exponents,
        bool[4] memory signs,
        uint256 x
    ) internal pure returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;

        for(uint256 degree; degree <= MAX_DEGREE; ++degree) {
            if(signs[degree]) {
                positiveSum = positiveSum.add(pow(x, degree).mul(significands[degree]).div(pow(10, exponents[degree])));
            } else {
                negativeSum = negativeSum.add(pow(x, degree).mul(significands[degree]).div(pow(10, exponents[degree])));
            }
        }
        return positiveSum.sub(negativeSum);
    }

    function evaluatePolynomialPiecewise(
        bytes calldata f,
        uint256 x,
        uint256 numPieces
    ) internal view returns (uint256 y) {
        uint256 pieceIndex = findPiecewiseIndex(f, x, numPieces.sub(1));
        y = evaluatePolynomial(
            getSignificands(f, pieceIndex, numPieces), 
            getExponents(f, pieceIndex, numPieces),
            getSigns(f, pieceIndex, numPieces),
            x - getPiecewiseBreakpoint(f, pieceIndex)
        );
    }

    /**
    * @notice Computes the integral of a cubic polynomial.
    * @param significands The numerators of the polynomial's coefficients (ordered by degree).
    * @param exponents Each significand is divided by 10^x where x is the exponent of that significand (ordered by degree).
    * @param signs The signs of the coefficient terms (ordered by degree).
    * @param start The lower bound of the integration. (unsafe past 10e13)
    * @param end The upper bound of the integration. (unsafe past 10e13)
    */
    function evaluatePolynomialIntegration(
        uint256[4] memory significands,
        uint8[4] memory exponents,
        bool[4] memory signs,
        uint256 start, //start of breakpoint is assumed to be subtracted
        uint256 end //start of breakpoint is assumed to be subtracted
    ) internal pure returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;
        
        for(uint256 degree; degree <= MAX_DEGREE; ++degree) {

            if(signs[degree]) {
                //uint256 max value is 1e77 and the maximum value we're expecting to evaluate is 1e14. 
                //1e14^4 is 1e56, leaving (1e77 - 1e56) around 1e20 in room for the significand's precision, past that it overflows.
                //Accordingly, the variable floating point has been set to 10e20 in the interpolation code.
                positiveSum = positiveSum.add(pow(end, 1 + degree).mul(significands[degree]).div(pow(10, exponents[degree]).mul(1 + degree)));

                positiveSum = positiveSum.sub(pow(start, 1 + degree).mul(significands[degree]).div(pow(10, exponents[degree]).mul(1 + degree)));
            } else {
                negativeSum = negativeSum.add(pow(end, 1 + degree).mul(significands[degree]).div(pow(10, exponents[degree]).mul(1 + degree)));

                negativeSum = negativeSum.sub(pow(end, 1 + degree).mul(significands[degree]).div(pow(10, exponents[degree]).mul(1 + degree)));
            }
        }

        return positiveSum.sub(negativeSum);
    }

    function evaluatePolynomialIntegrationPiecewise(
        uint256 integrateFrom, 
        uint256 integrateTo,
        bytes calldata f,
        uint256 numPieces
    ) internal view returns (uint256 integral) {

        uint256 currentPieceIndex = findPiecewiseIndex(f, integrateFrom, numPieces.sub(1));
        console.log("currentPieceIndex:", currentPieceIndex);
        uint256 currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
        uint256 nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
        bool integrateToEnd;
        
        if(integrateFrom < currentPieceStart) {
            integrateFrom = currentPieceStart;
            integrateTo = integrateTo.add(currentPieceStart.sub(integrateFrom));
        }

        while (!integrateToEnd) {
            console.log("integral: ", integral);

            if(currentPieceIndex != numPieces.sub(1) && integrateTo > nextPieceStart) {
                integrateToEnd = false;
            } else {
                integrateToEnd = true;
            }
            console.log("breakpoint: ", currentPieceStart);

            if(integrateToEnd) {
                integral += evaluatePolynomialIntegration(
                    getSignificands(f, currentPieceIndex, numPieces), 
                    getExponents(f, currentPieceIndex, numPieces), 
                    getSigns(f, currentPieceIndex, numPieces), 
                    integrateFrom - currentPieceStart, 
                    integrateTo - currentPieceStart
                );
            } else {
                integral += evaluatePolynomialIntegration(
                    getSignificands(f, currentPieceIndex, numPieces), 
                    getExponents(f, currentPieceIndex, numPieces), 
                    getSigns(f, currentPieceIndex, numPieces), 
                    integrateFrom - currentPieceStart, 
                    nextPieceStart - currentPieceStart
                );
                integrateFrom = nextPieceStart;
                
                if(currentPieceIndex < (numPieces - 1)) {
                    currentPieceIndex++;
                    currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
                    nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
                }
            }

        }
    }


    // /**
    // * @notice Retrieves the uint8 coefficient exponent at the specified index within the packed value.
    // * @dev 32 base indices are available per uint256 with each exponent taking up 8 bits of space. 
    // * @param packedExponents A uint256 created from the concatenation of up to 32 uint8 values.
    // * @param pieceIndex The index of the piece to retrieve the base for.
    // */
    // function getPackedExponents(uint256 packedExponents, uint256 pieceIndex) internal pure returns (uint8[4] memory) {
    //     uint8[4] memory exponents;
    //     uint256 relativeIndex = (pieceIndex % 8)*4; //index of the base in the relevant uint256

    //     exponents[0] = uint8(packedExponents >> ((32 - relativeIndex - 1)*8));
    //     exponents[1] = uint8(packedExponents >> ((32 - (relativeIndex + 1) - 1)*8));
    //     exponents[2] = uint8(packedExponents >> ((32 - (relativeIndex + 2) - 1)*8));
    //     exponents[3] = uint8(packedExponents >> ((32 - (relativeIndex + 3) - 1)*8));
        
    //     return exponents; 
    // }

    // /**
    // * @notice Retrieves the sign (bool value) at specified index.
    // * @dev 256 sign indices are available per uint256. 1 bit is allocated per sign. 
    // * @param packedBools A uint256 from the concatenation of up to 256 boolean bit values.
    // * @param pieceIndex The index of the piecewise polynomial to get signs for.
    // */
    // function getPackedSigns(uint256 packedBools, uint256 pieceIndex) internal pure returns (bool[4] memory) {
    //     bool[4] memory signs;

    //     signs[0] = ((packedBools >> (pieceIndex*4)) & uint256(1) == 1);
    //     signs[1] = ((packedBools >> (pieceIndex*4 + 1)) & uint256(1) == 1);
    //     signs[2] = ((packedBools >> (pieceIndex*4 + 2)) & uint256(1) == 1);
    //     signs[3] = ((packedBools >> (pieceIndex*4 + 3)) & uint256(1) == 1);

    //     return signs;
    // }

    /**
    * @notice Searches for index of interval containing x
    * @dev [inclusiveStart, exclusiveEnd). -> If a value is at a breakpoint, it is considered to be in the next interval. 
    * @param value The value to search for.
    * @param high The highest index of the array to search. Could be retrieved from getNumPieces(arr) - 1.
    */
    function findPiecewiseIndex(bytes calldata f, uint256 value, uint256 high) internal pure returns (uint256 index) {
        uint256 breakpointAtIndex = getPiecewiseBreakpoint(f, 0);
        if(value < breakpointAtIndex) return 0;
        
        uint256 low = 0;
        
        while(low < high) {
            if(breakpointAtIndex == value) return low;
            else if(breakpointAtIndex > value) return low - 1;
            else low++;
            breakpointAtIndex = getPiecewiseBreakpoint(f, low);
        }

        return low - 1;
    }

    function getPiecewiseBreakpoint(bytes calldata f, uint256 pieceIndex) internal pure returns (uint256) {
        //the index of pieces starts at 0 within the byte array and ends at 32*n where n is the number of total pieces
        //we need to load calldata from position 32xpieceIndex
        return abi.decode(f[32*pieceIndex:32*(pieceIndex+1)], (uint256));
    }

    function getSignificands(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal view returns (uint256[4] memory significands) {
        //the index of pieces starts at 0 within the byte array and ends at 32*n where n is the number of total pieces
        //we need to load calldata from position 32*(pieceIndex+1) because pieceIndex starts at 0
        uint256 skipBytes = 32*(numPieces) + 96;
        
        significands[0] = abi.decode(f[skipBytes + 128*pieceIndex:skipBytes + 128*pieceIndex + 32], (uint256));

        significands[1] = abi.decode(f[skipBytes + 128*pieceIndex + 32:skipBytes + 128*pieceIndex + 64], (uint256));

        significands[2] = abi.decode(f[skipBytes + 128*pieceIndex + 64:skipBytes + 128*pieceIndex + 96], (uint256));

        significands[3] = abi.decode(f[skipBytes + 128*pieceIndex + 96:skipBytes + 128*pieceIndex + 128], (uint256));
        console.log(significands[0], significands[1], significands[2], significands[3]);


    }

    function getExponents(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal view returns(uint8[4] memory exponents) {
        uint256 skipBytes = 160*numPieces + 384 + 96;
        exponents[0] = abi.decode(f[skipBytes + 128*pieceIndex:skipBytes + 128*pieceIndex + 32], (uint8));
        exponents[1] = abi.decode(f[skipBytes + 128*pieceIndex + 32:skipBytes + 128*pieceIndex + 64], (uint8));
        exponents[2] = abi.decode(f[skipBytes + 128*pieceIndex + 64:skipBytes + 128*pieceIndex + 96], (uint8));
        exponents[3] = abi.decode(f[skipBytes + 128*pieceIndex + 96:skipBytes + 128*pieceIndex + 128], (uint8));
        console.log(exponents[0], exponents[1], exponents[2], exponents[3]);
    }

    function getSigns(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal view returns(bool[4] memory signs) {
        uint256 skipBytes = 288*numPieces + 384 + 384 + 96;
        signs[0] = abi.decode(f[skipBytes + 128*pieceIndex:skipBytes + 128*pieceIndex + 32], (bool));
        signs[1] = abi.decode(f[skipBytes + 128*pieceIndex + 32:skipBytes + 128*pieceIndex + 64], (bool));
        signs[2] = abi.decode(f[skipBytes + 128*pieceIndex + 64:skipBytes + 128*pieceIndex + 96], (bool));
        signs[3] = abi.decode(f[skipBytes + 128*pieceIndex + 96:skipBytes + 128*pieceIndex + 128], (bool));
        console.log(signs[0], signs[1], signs[2], signs[3]);
    }

    /**
    * @notice A safe way to take the power of a number.
    */
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