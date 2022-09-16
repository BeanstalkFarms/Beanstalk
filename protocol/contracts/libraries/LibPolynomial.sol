/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
 
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibBytes.sol";
import "hardhat/console.sol";
 
 
 /* 
 * @author: Malteasy
 * @title: Polynomial Pricing
 */
 
library LibPolynomial { 

    using SafeMath for uint256;

    using LibBytes for bytes;

    /**
        The polynomial's constant terms are split into: 1) constant * 10^exponent , 2) the exponent the constant is raised to in base 10 and, 3) the sign of the coefficients.
        Example conversion to Piecewise: 

            Range(0, 1) -> Polynomial(0.25*x^3 + 25*x^2 + x + 1)
            Range(1, 2) -> Polynomial(0.0125*x^3 + 50*x^2 + x - 2)
            Range(2, Infinity) -> Polynomial(-1)
            
        Resulting Piecewise:

            breakpoints: [0, 1, 2, 0, 0, ... , 0]
            significands: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, ... , 0]
            (expanded) coefficient exponents: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, ... , 0]
            (expanded) signs: [true, true, true, true, false, true, true, true, false, false, false, ... , false]

        The resulting piecewise is then encoded into a single bytes array by concatenating as follows, where n is the number of polynomial pieces: 
            [
                n, (32 bytes)
                breakpoints, (32n bytes)
                significands, (128n bytes)
                exponents, (4n bytes)
                signs, (4n bytes)
            ]
        
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
        uint256 x
    ) internal pure returns (uint256 y) {
        uint256 numPieces = getNumPieces(f);
        uint256 pieceIndex = findPiecewiseIndex(f, x, numPieces.sub(1));
        //Note: overflows if x is not in range of piece index
        y = evaluatePolynomial(
            getSignificands(f, pieceIndex, numPieces), 
            getExponents(f, pieceIndex, numPieces),
            getSigns(f, pieceIndex, numPieces),
            x.sub(getPiecewiseBreakpoint(f, pieceIndex), "evaluation must be within piecewise bounds")
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
                //uint256 max value is 1e77 and this has been tested to work to not overflow for values less than 1e14. 
                //Note: susceptible to overflows past 1e14
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
        bytes calldata f
    ) internal pure returns (uint256 integral) {
        uint256 numPieces = getNumPieces(f);
        uint256 currentPieceIndex = findPiecewiseIndex(f, integrateFrom, numPieces.sub(1));
        uint256 currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
        uint256 nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
        bool integrateToEnd;
        
        if(integrateFrom < currentPieceStart) {
            integrateFrom = currentPieceStart;
            integrateTo = integrateTo.add(currentPieceStart.sub(integrateFrom));
        }

        while (!integrateToEnd) {

            if(currentPieceIndex != numPieces.sub(1) && integrateTo > nextPieceStart) {
                integrateToEnd = false;
            } else {
                integrateToEnd = true;
            }

            if(integrateToEnd) {
                integral = integral.add(evaluatePolynomialIntegration(
                    getSignificands(f, currentPieceIndex, numPieces), 
                    getExponents(f, currentPieceIndex, numPieces), 
                    getSigns(f, currentPieceIndex, numPieces), 
                    integrateFrom - currentPieceStart, 
                    integrateTo - currentPieceStart
                ));
            } else {
                integral = integral.add(evaluatePolynomialIntegration(
                    getSignificands(f, currentPieceIndex, numPieces), 
                    getExponents(f, currentPieceIndex, numPieces), 
                    getSigns(f, currentPieceIndex, numPieces), 
                    integrateFrom - currentPieceStart, 
                    nextPieceStart - currentPieceStart
                ));

                integrateFrom = nextPieceStart;
                
                if(currentPieceIndex < (numPieces - 1)) {
                    currentPieceIndex++;
                    currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
                    nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
                }
            }

        }
    }
    
    /**
    * @notice Searches for index of interval containing x
    * @dev [inclusiveStart, exclusiveEnd)
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

    /**
      Function calldata parsing.
      Note: Abi.decode is not being used because of the minimum 32 bytes per parameter requirement.
    */

    // /**
    // * @notice Retrieves the length of pieces in a piecewise polynomial. 
    // * @dev Stored as the first 32 bytes of the piecewise function data.
    // * @param f The function data of the piecewise polynomial.
    // */
    function getNumPieces(bytes calldata f) internal pure returns (uint256) {
        return sliceToMemory(f, 0, 32).toUint256(0);
    }

    // /**
    // * @notice Retrieves the breakpoint at the specified piecewise index.
    // * @dev Stored in function data after the first 32 bytes. Occupies 32n bytes, where n is the number of polynomial pieces.
    // * @param f The function data of the piecewise polynomial.
    // */
    function getPiecewiseBreakpoint(bytes calldata f, uint256 pieceIndex) internal pure returns (uint256) {
        return sliceToMemory(f, 32 + 32*pieceIndex, 32).toUint256(0);
    }

    // /**
    // * @notice Retrieves the coefficient significands of a cubic polynomial at specified piecewise index. (significands / 10^exponent = coefficientValue)
    // * @dev Stored in function data after the first 32 + 32n bytes. Occupies 128n bytes, where n is the number of polynomial pieces.
    // * @param f The function data of the piecewise polynomial.
    // * @param pieceIndex The index of the piecewise polynomial to get signs for.
    // * @param numPieces The number of pieces in the piecewise polynomial.
    // */
    function getSignificands(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns (uint256[4] memory significands) {
        bytes memory significandSlice = sliceToMemory(f, (32 + (numPieces.mul(32)) + pieceIndex.mul(128)), 128);
        significands[0] = significandSlice.toUint256(0);
        significands[1] = significandSlice.toUint256(32);
        significands[2] = significandSlice.toUint256(64);
        significands[3] = significandSlice.toUint256(96);
    }

    // /**
    // * @notice Retrieves the exponents for the coefficients of a cubic polynomial at specified piecewise index. (significand / 10^exponent = coefficientValue)
    // * @dev Stored in function data after the first 32 + 32n + 128n bytes. Occupies 4n bytes, where n is the number of polynomial pieces.
    // * @param f The function data of the piecewise polynomial.
    // * @param pieceIndex The index of the piecewise polynomial to get signs for.
    // * @param numPieces The number of pieces in the piecewise polynomial.
    // */
    function getExponents(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns(uint8[4] memory exponents) {
        bytes memory exponentSlice = sliceToMemory(f, (32 + (numPieces.mul(32)) + (numPieces.mul(128))+ pieceIndex.mul(4)), 4);
        exponents[0] = exponentSlice.toUint8(0);
        exponents[1] = exponentSlice.toUint8(1);
        exponents[2] = exponentSlice.toUint8(2);
        exponents[3] = exponentSlice.toUint8(3);
    }

    // /**
    // * @notice Retrieves the signs (bool values) for the coefficients of a cubic polynomial at specified piecewise index.
    // * @dev Stored in function data after the first 32 + 32n + 128n + 4n bytes. Occupies 4n bytes, where n is the number of polynomial pieces.
    // * @param f The function data of the piecewise polynomial.
    // * @param pieceIndex The index of the piecewise polynomial to get signs for.
    // * @param numPieces The number of pieces in the piecewise polynomial.
    // */
    function getSigns(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns(bool[4] memory signs) {
        bytes memory signSlice = sliceToMemory(f, (32 + (numPieces.mul(32)) + (numPieces.mul(128))+ (numPieces.mul(4)) + pieceIndex.mul(4)), 4);
        signs[0] = signSlice.toUint8(0) == 1;
        signs[1] = signSlice.toUint8(1) == 1;
        signs[2] = signSlice.toUint8(2) == 1; 
        signs[3] = signSlice.toUint8(3) == 1;
    }

    // /**
    // * @notice Loads a slice of a calldata bytes array into memory
    // * @param b The calldata bytes array to load from
    // * @param start The start of the slice
    // * @param length The length of the slice
    // */
    function sliceToMemory(bytes calldata b, uint256 start, uint256 length) internal pure returns (bytes memory) {
        bytes memory memBytes = new bytes(length);
        for(uint256 i = 0; i < length; ++i) {
            memBytes[i] = b[start + i];
        }
        return memBytes;
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
            for(uint256 i = 1; i < exponent; ++i) 
                z = z.mul(base);
            return z;
        }
    }
}