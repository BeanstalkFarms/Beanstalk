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

    uint256 constant numPieces = 32; //the maximum number of pieces in a PiecewiseFunction
    uint256 constant maxFunctionDegree = 3; //the maximum degree of evaluation for a polynomial
    uint256 constant indexMultiplier = 4;
    uint256 constant valueIndexMultiplier = 5;
    uint256 constant numMeta = 128; //the size of the bases and signs array
    uint256 constant numValues = 160;

    // The values array contains the concatenation of 32 pieces following the form for each piece: [v0, v1, v2, v3, startInterval]
    struct PiecewiseFunction {
        PricingMode mode;
        uint256[numValues] values; // This general values array is a concatenation of all the values of the polynomial and the start interval associated with each polynomial.
        uint8[numMeta] bases; // Every non-interval value in 'values' is associated with a fixed point base. The amount of fixed points and the base is calculated during the interpolation phase
        bool[numMeta] signs; // It would be possible to pack all the signs in one uint256, but this is not implemented yet.
    }

    struct PackedPiecewiseFunction {
        PricingMode mode;
        uint256[numValues] values;
        uint256[4] bases; //bases[0] represents index 0-32, bases[1] represents index 33-64, bases[2] represents index 65-96, bases[3] represents index 97-128
        uint256 signs;
    }

    function createZeros() internal pure returns (uint256[numValues] memory valueArray, uint256[indexMultiplier] memory baseArray, uint256 signArray) {
        for (uint256 i = 0; i < numValues; i++) {
            valueArray[i] = 0;
            if(i < indexMultiplier){
                baseArray[i] = 0;
            }
        }
        
        return (valueArray, baseArray, 0);
    }

    // function createZeros() internal pure returns (uint256[numValues] memory valueArray, uint8[numMeta] memory baseArray, bool[numMeta] memory signArray) {
    //     for (uint256 i = 0; i < numValues; i++) {
    //         valueArray[i] = 0;
    //         if(i < numMeta){
    //             baseArray[i] = 0;
    //             signArray[i] = false;
    //         }
    //     }
        
    //     return (valueArray, baseArray, signArray);
    // }

    //Packed Evaluation of a PiecewiseFunction

    function evaluatePackedPF(PackedPiecewiseFunction calldata f, uint256 x, uint256 i, uint256 deg) internal pure returns (uint256) {
        uint256 degIdx;
        uint256 yP;
        uint256 yN;
        uint256 temp;

        while(degIdx <= deg) {
            // evaluate in the form v3(x-k)^3 + v2(x-k)^2 + v1(x-k) + v0
            uint256 baseIndex = (i*indexMultiplier + degIdx) / 32;
           
            temp = pow(x - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx)
                .mul(f.values[i*valueIndexMultiplier + degIdx])
                .div(pow(10, getPackedBase(f.bases[baseIndex], i)));

            if(getPackedSign(f.signs, i*indexMultiplier + degIdx))
                yP = yP.add(temp);
            else 
                yN = yN.add(temp);
        
            degIdx++;
        }

        return yP.sub(yN);
    }

     //Piecewise Evaluation
     function evaluatePiecewiseFunction(PiecewiseFunction calldata f, uint256 x, uint256 i, uint256 deg) internal pure returns (uint256) {
        uint256 degIdx;
        uint256 yP;
        uint256 yN;
        uint256 temp;

        while(degIdx <= deg) {
            // evaluate in the form v3(x-k)^3 + v2(x-k)^2 + v1(x-k) + v0
            temp = pow(x - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx).mul(f.values[i*valueIndexMultiplier + degIdx]).div(pow(10, f.bases[i*indexMultiplier + degIdx]) );
           
            if(f.signs[i*indexMultiplier + degIdx]) 
                yP = yP.add(temp);
            else 
                yN = yN.add(temp);
        
            degIdx++;
        }

        return yP.sub(yN);
     }
 
     //Piecewise Integration
     /**
     * @dev Calculates the integral of a piecewise function.
     *
     * 
     */
     function evalPiecewiseFunctionIntegrate(
        PiecewiseFunction calldata f, 
        uint256 x1, 
        uint256 x2, 
        uint256 i, 
        uint256 deg
    ) internal pure returns (uint256) {
        uint256 degIdx;
        uint256 yP;
        uint256 yN;

        uint256 temp;

        while(degIdx <= deg) {
            // to integrate from x1 to x2 we need to evaluate the expression
            // ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 ) - ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )
            temp = pow(
                x2 - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx+1
                ).mul(
                    f.values[i*valueIndexMultiplier + degIdx]
                ).div(
                    pow(10, f.bases[i*indexMultiplier +degIdx]).mul(degIdx + 1))
                - pow(
                    x1 - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx+1
                ).mul(
                    f.values[i*valueIndexMultiplier + degIdx]
                ).div(
                    pow(10, f.bases[i*indexMultiplier +degIdx]).mul(degIdx + 1)
                );

            if(f.signs[i*indexMultiplier + degIdx]) 
                yP = yP.add(temp);
            else 
                yN = yN.add(temp);

            degIdx++;
        }
        return yP - yN;
     }

     function evalPackedPFIntegrate(
        PackedPiecewiseFunction calldata f, 
        uint256 x1, 
        uint256 x2, 
        uint256 i, 
        uint256 deg
    ) internal pure returns (uint256) {
        uint256 degIdx;
        uint256 yP;
        uint256 yN;

        uint256 temp;

        while(degIdx <= deg) {
            // to integrate from x1 to x2 we need to evaluate the expression
            // ( v3(x2-k)^4/4 + v2(x2-k)^3/3 + v1(x2-k)^2/2 + v0*x2 ) - ( v3(x1-k)^4/4 + v2(x1-k)^3/3 + v1(x1-k)^2/2 + v0*x1 )
            // uint256 baseIndex = (i*indexMultiplier + degIdx) / 32;
            uint256 base = getPackedBase(f.bases[(i*indexMultiplier + degIdx) / 32], i);
            {   
                temp = pow(
                    x2 - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx+1
                    ).mul(
                        f.values[i*valueIndexMultiplier + degIdx]
                    ).div(
                        pow(10, base).mul(degIdx + 1));
            }
            {
                temp -= pow(
                    x1 - f.values[i*valueIndexMultiplier + indexMultiplier], degIdx+1
                ).mul(
                    f.values[i*valueIndexMultiplier + degIdx]
                ).div(
                    pow(10, base).mul(degIdx + 1)
                );
            }
            if(getPackedSign(f.signs, i*indexMultiplier + degIdx)) 
                yP = yP.add(temp);
            else 
                yN = yN.add(temp);

            degIdx++;
        }
        return yP - yN;
     }
 
    function getPackedBase(uint256 packedBases, uint256 index) internal pure returns (uint8) {
        return uint8(packedBases << (index*8));
    }
    function getPackedSign(uint256 packedBools, uint256 index) internal pure returns (bool) {
        return ((packedBools >> index) & uint256(1) == 1);
    }
 
     //This is to prevent the evaluation loop from running redundant calculations.
     function getFunctionDegree(PiecewiseFunction calldata f, uint256 index) internal pure returns (uint256 deg) {
         deg = maxFunctionDegree;
         while(f.values[index*valueIndexMultiplier + deg] == 0) {
             deg--;
         }
     }

     function getPackedFunctionDegree(PackedPiecewiseFunction calldata f, uint256 index) internal pure returns (uint256 deg) {
        deg = maxFunctionDegree;
        while(f.values[index*valueIndexMultiplier + deg] == 0) {
            deg--;
        }
    }
 
     //extract the subinterval array from the general values array 
     function parseIntervals(uint256[numValues] calldata values) internal pure returns(uint256[] memory) {
        uint256 i;

        for(uint256 j = 0; j < numPieces; j++) {

            if(values[j*valueIndexMultiplier + indexMultiplier] == 0 && j != 0) {
                break;
            } else {
                i++;
            }
        }

        uint256[] memory parsedIntervals = new uint256[](i);
        for(uint256 c = 0; c < i; c++) {
            parsedIntervals[c] = values[c*valueIndexMultiplier + indexMultiplier]; // removed check for monotonicity
        }

        return parsedIntervals;
     }
 
     //find the index of the interval containing x with the start of the interval being inclusive and the end of the interval being exclusive.
     // [inclusiveStart, exclusiveEnd)
    function findIndex(uint256[] memory array, uint256 value) internal pure returns (uint256) {
        int256 low;
        int256 high = int(array.length - 1);
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