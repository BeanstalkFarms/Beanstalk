/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
 
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibBytes.sol";
 
/* 
* @author: Malteasy
* @title: LibPolynomial
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

        breakpoints: [0, 1, 2]
        significands: [1, 1, 25, 25, 2, 1, 50, 125, 1, 0, 0, 0]
        (expanded) coefficient exponents: [0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 0]
        (expanded) signs: [true, true, true, true, false, true, true, true, false, false, false, false]

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
    * @dev Polynomial is of the form a(x-k)^3 + b(x-k)^2 + c(x-k) + d where k is the start of the piecewise interval
    * @param f The encoded piecewise polynomial
    * @param pieceIndex Which piece of the polynomial to evaluate
    * @param numPieces The number of pieces in the polynomial
    * @param x The value to be evaluated at.
    */
    function evaluatePolynomial(
        bytes calldata f,
        uint256 pieceIndex,
        uint256 numPieces,
        uint256 x
    ) internal pure returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;

        uint256[4] memory significands = getSignificands(f, pieceIndex, numPieces);
        uint8[4] memory exponents = getExponents(f, pieceIndex, numPieces);
        bool[4] memory signs = getSigns(f, pieceIndex, numPieces);
        
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
        uint256 pieceIndex = findPiecewiseIndex(f, x, numPieces);
        y = evaluatePolynomial(f, pieceIndex, numPieces,
            x.sub(getPiecewiseBreakpoint(f, pieceIndex), "Evaluation must be within piecewise bounds")
        );
    }

    /**
    * @notice Computes the integral of a cubic polynomial 
    * @dev Polynomial is of the form a(x-k)^3 + b(x-k)^2 + c(x-k) + d where k is the start of the piecewise interval
    * @param f The encoded piecewise polynomial
    * @param pieceIndex Which piece of the polynomial to evaluate
    * @param numPieces The number of pieces in the polynomial
    * @param start The lower bound of the integration. (can overflow past 10e13)
    * @param end The upper bound of the integration. (can overflow past 10e13)
    */
    function evaluatePolynomialIntegration(
        bytes calldata f,
        uint256 pieceIndex,
        uint256 numPieces,
        uint256 start, //start of breakpoint is assumed to be subtracted
        uint256 end //start of breakpoint is assumed to be subtracted
    ) internal pure returns (uint256) {
        uint256 positiveSum;
        uint256 negativeSum;

        uint256[4] memory significands = getSignificands(f, pieceIndex, numPieces);
        uint8[4] memory exponents = getExponents(f, pieceIndex, numPieces);
        bool[4] memory signs = getSigns(f, pieceIndex, numPieces);
        
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
        bytes calldata f,
        uint256 start, 
        uint256 end
    ) internal pure returns (uint256 integral) {
        uint256 numPieces = getNumPieces(f);
        uint256 currentPieceIndex = findPiecewiseIndex(f, start, numPieces);
        uint256 currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
        uint256 nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
        bool integrateToEnd;

        while (!integrateToEnd) {
            if(end > nextPieceStart) {
                integrateToEnd = false;
            } else {
                integrateToEnd = true;
            }

            uint256 startIntegration = start.sub(currentPieceStart, "Evaluation must be within piecewise bounds.");
            uint256 endIntegration = integrateToEnd ? end.sub(currentPieceStart) : nextPieceStart.sub(currentPieceStart);

            integral = integral.add(evaluatePolynomialIntegration(f, currentPieceIndex, numPieces, 
                startIntegration, 
                endIntegration
            ));

            if(!integrateToEnd) {
                start = nextPieceStart;
                if(currentPieceIndex == (numPieces - 1)) {
                    //reached end of piecewise
                    integrateToEnd = true;
                } else {
                    //continue to next piece
                    currentPieceIndex++;
                    currentPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex);
                    if(currentPieceIndex != (numPieces - 1)) nextPieceStart = getPiecewiseBreakpoint(f, currentPieceIndex + 1);
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
    function findPiecewiseIndex(bytes calldata f, uint256 value, uint256 high) internal pure returns (uint256) {
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
    */

    /**
    * @notice Retrieves the length of pieces in a piecewise polynomial. 
    * @dev Stored as the first 32 bytes of the piecewise function data.
    * @param f The function data of the piecewise polynomial.
    */
    function getNumPieces(bytes calldata f) internal pure returns (uint256) {
        return f.sliceToMemory(0, 32).toUint256(0);
    }

    /**
    * @notice Retrieves the breakpoint at the specified piecewise index.
    * @dev Stored in function data after the first 32 bytes. Occupies 32n bytes, where n is the number of polynomial pieces.
    * @param f The function data of the piecewise polynomial.
    */
    function getPiecewiseBreakpoint(bytes calldata f, uint256 pieceIndex) internal pure returns (uint256) {
        return f.sliceToMemory((pieceIndex.mul(32)).add(32), 32).toUint256(0);
    }

    /**
    * @notice Retrieves the coefficient significands of a cubic polynomial at specified piecewise index. (significands / 10^exponent = coefficientValue)
    * @dev Stored in function data after the first 32 + 32n bytes. Occupies 128n bytes, where n is the number of polynomial pieces.
    * @param f The function data of the piecewise polynomial.
    * @param pieceIndex The index of the piecewise polynomial to get signs for.
    * @param numPieces The number of pieces in the piecewise polynomial.
    */
    function getSignificands(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns (uint256[4] memory significands) {
        bytes memory significandSlice = f.sliceToMemory((pieceIndex.mul(128)).add(numPieces.mul(32)).add(32), 128);
        significands[0] = significandSlice.toUint256(0);
        significands[1] = significandSlice.toUint256(32);
        significands[2] = significandSlice.toUint256(64);
        significands[3] = significandSlice.toUint256(96);
    }

    /**
    * @notice Retrieves the exponents for the coefficients of a cubic polynomial at specified piecewise index. (significand / 10^exponent = coefficientValue)
    * @dev Stored in function data after the first 32 + 32n + 128n bytes. Occupies 4n bytes, where n is the number of polynomial pieces.
    * @param f The function data of the piecewise polynomial.
    * @param pieceIndex The index of the piecewise polynomial to get signs for.
    * @param numPieces The number of pieces in the piecewise polynomial.
    */
    function getExponents(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns(uint8[4] memory exponents) {
        bytes memory exponentSlice = f.sliceToMemory((pieceIndex.mul(4)).add(numPieces.mul(160)).add(32), 4);
        exponents[0] = exponentSlice.toUint8(0);
        exponents[1] = exponentSlice.toUint8(1);
        exponents[2] = exponentSlice.toUint8(2);
        exponents[3] = exponentSlice.toUint8(3);
    }

    /**
    * @notice Retrieves the signs (bool values) for the coefficients of a cubic polynomial at specified piecewise index.
    * @dev Stored in function data after the first 32 + 32n + 128n + 4n bytes. Occupies 4n bytes, where n is the number of polynomial pieces.
    * @param f The function data of the piecewise polynomial.
    * @param pieceIndex The index of the piecewise polynomial to get signs for.
    * @param numPieces The number of pieces in the piecewise polynomial.
    */
    function getSigns(bytes calldata f, uint256 pieceIndex, uint256 numPieces) internal pure returns(bool[4] memory signs) {
        bytes memory signSlice = f.sliceToMemory((pieceIndex.mul(4)).add(numPieces.mul(164)).add(32), 4);
        signs[0] = signSlice.toUint8(0) == 1;
        signs[1] = signSlice.toUint8(1) == 1;
        signs[2] = signSlice.toUint8(2) == 1; 
        signs[3] = signSlice.toUint8(3) == 1;
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