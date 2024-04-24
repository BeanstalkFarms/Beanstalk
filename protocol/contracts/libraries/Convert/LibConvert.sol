// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibCurveConvert} from "./LibCurveConvert.sol";
import {LibUnripeConvert} from "./LibUnripeConvert.sol";
import {LibLambdaConvert} from "./LibLambdaConvert.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibWellConvert} from "./LibWellConvert.sol";
import {LibChopConvert} from "./LibChopConvert.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {C} from "contracts/C.sol";

/**
 * @title LibConvert
 * @author Publius
 */
library LibConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;
    using LibWell for address;
    using SignedSafeMath for int256;

    /**
     * @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
     * a specified pool and returns the in and out convert amounts and token addresses and bdv
     * @param convertData Contains convert input parameters for a specified convert
     */
    function convert(bytes calldata convertData)
        external
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        LibConvertData.ConvertKind kind = convertData.convertKind();

        // if (kind == LibConvertData.ConvertKind.BEANS_TO_CURVE_LP) {
        //     (tokenOut, tokenIn, amountOut, amountIn) = LibCurveConvert
        //         .convertBeansToLP(convertData);
        if (kind == LibConvertData.ConvertKind.CURVE_LP_TO_BEANS) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibCurveConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_BEANS_TO_UNRIPE_LP) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibUnripeConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_LP_TO_UNRIPE_BEANS) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibUnripeConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibLambdaConvert
                .convert(convertData);
        } else if (kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibWellConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.WELL_LP_TO_BEANS) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibWellConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_TO_RIPE) {
            (tokenOut, tokenIn, amountOut, amountIn) = LibChopConvert
                .convertUnripeToRipe(convertData);
        } else {
            revert("Convert: Invalid payload");
        }
    }

    function getMaxAmountIn(address tokenIn, address tokenOut)
        internal
        view
        returns (uint256)
    {
        /// BEAN:3CRV LP -> BEAN
        if (tokenIn == C.CURVE_BEAN_METAPOOL && tokenOut == C.BEAN)
            return LibCurveConvert.lpToPeg(C.CURVE_BEAN_METAPOOL);
        
        /// BEAN -> BEAN:3CRV LP
        // NOTE: cannot convert due to bean:3crv dewhitelisting
        // if (tokenIn == C.BEAN && tokenOut == C.CURVE_BEAN_METAPOOL)
        //     return LibCurveConvert.beansToPeg(C.CURVE_BEAN_METAPOOL);
        
        // Lambda -> Lambda
        if (tokenIn == tokenOut) 
            return type(uint256).max;

        // Bean -> Well LP Token
        if (tokenIn == C.BEAN && tokenOut.isWell())
            return LibWellConvert.beansToPeg(tokenOut);

        // Well LP Token -> Bean
        if (tokenIn.isWell() && tokenOut == C.BEAN)
            return LibWellConvert.lpToPeg(tokenIn);

        // urLP Convert
        if (tokenIn == C.UNRIPE_LP){
            // UrBEANETH -> urBEAN
            if (tokenOut == C.UNRIPE_BEAN)
                return LibUnripeConvert.lpToPeg();
            // UrBEANETH -> BEANETH
            if (tokenOut == LibBarnRaise.getBarnRaiseWell())
                return type(uint256).max;
        }

        // urBEAN Convert
        if (tokenIn == C.UNRIPE_BEAN){
            // urBEAN -> urLP
            if (tokenOut == C.UNRIPE_LP)
                return LibUnripeConvert.beansToPeg();
            // UrBEAN -> BEAN
            if (tokenOut == C.BEAN)
                return type(uint256).max;
        }

        revert("Convert: Tokens not supported");
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        internal
        view
        returns (uint256)
    {
        /// BEAN:3CRV LP -> BEAN
        if (tokenIn == C.CURVE_BEAN_METAPOOL && tokenOut == C.BEAN)
            return LibCurveConvert.getBeanAmountOut(C.CURVE_BEAN_METAPOOL, amountIn);
        
        /// BEAN -> BEAN:3CRV LP
        // NOTE: cannot convert due to bean:3crv dewhitelisting
        // if (tokenIn == C.BEAN && tokenOut == C.CURVE_BEAN_METAPOOL)
        //     return LibCurveConvert.getLPAmountOut(C.CURVE_BEAN_METAPOOL, amountIn);

        /// urLP -> urBEAN
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.UNRIPE_BEAN)
            return LibUnripeConvert.getBeanAmountOut(amountIn);
        
        /// urBEAN -> urLP
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.UNRIPE_LP)
            return LibUnripeConvert.getLPAmountOut(amountIn);
        
        // Lambda -> Lambda
        if (tokenIn == tokenOut)
            return amountIn;

        // Bean -> Well LP Token
        if (tokenIn == C.BEAN && tokenOut.isWell())
            return LibWellConvert.getLPAmountOut(tokenOut, amountIn);

        // Well LP Token -> Bean
        if (tokenIn.isWell() && tokenOut == C.BEAN)
            return LibWellConvert.getBeanAmountOut(tokenIn, amountIn);

        // UrBEAN -> Bean
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.BEAN)
            return LibChopConvert.getConvertedUnderlyingOut(tokenIn, amountIn);

        // UrBEANETH -> BEANETH
        if (tokenIn == C.UNRIPE_LP && tokenOut == LibBarnRaise.getBarnRaiseWell())
            return LibChopConvert.getConvertedUnderlyingOut(tokenIn, amountIn);

        revert("Convert: Tokens not supported");
    }

    /**
     * @notice Calculates the percentStalkPenalty for a given convert.
     * @dev The percentStalkPenalty is the amount of Stalk that is lost as a result of converting against
     * or past peg.
     * @param beforeDeltaB The deltaB before the deposit.
     * @param afterDeltaB The deltaB after the deposit.
     * @param bdvConverted The amount of BDVs that were removed, will be summed in this function.
     * @param cappedDeltaB The absolute value of capped deltaB, used to setup per-block conversion limits.
     * @return stalkPenaltyBdv The BDV amount that should be penalized, 0 means no penalty, full bdv returned means all bdv penalized
     */
    function calculateStalkPenalty(int256 beforeDeltaB, int256 afterDeltaB, uint256 bdvConverted, uint256 cappedDeltaB) internal returns (uint256 stalkPenaltyBdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // represents how far past peg deltaB was moved
        uint256 crossoverAmount;

        // the bdv amount that was converted against peg
        uint256 amountAgainstPeg = abs(afterDeltaB.sub(beforeDeltaB));

        // we could potentially be right at zero often with automated tractor converts
        if (beforeDeltaB == 0 && afterDeltaB != 0) {
            //this means we converted away from peg, so amount against peg is penalty
            return amountAgainstPeg;
        }

        // Check if the signs of beforeDeltaB and afterDeltaB are different,
        // indicating that deltaB has crossed zero
        if ((beforeDeltaB > 0 && afterDeltaB < 0) || (beforeDeltaB < 0 && afterDeltaB > 0)) {
            // Calculate how far past peg we went - so actually this is just abs of new deltaB
            crossoverAmount = abs(afterDeltaB);

            // Check if the crossoverAmount is greater than or equal to bdvConverted
            // TODO: see if we can find cases where bdcConverted doesn't match the deltaB diff? should always in theory afaict
            if (crossoverAmount > bdvConverted) {
                // If the entire bdvConverted amount crossed over, something is fishy, bdv amounts wrong?
                revert("Convert: converted farther than bdv");
            } else {
                return crossoverAmount;
            }
        } else if (beforeDeltaB <= 0 && afterDeltaB < beforeDeltaB) {
            return amountAgainstPeg;
        } else if (beforeDeltaB >= 0 && afterDeltaB > beforeDeltaB) {
            return amountAgainstPeg;
        }

        // at this point we are converting in direction of peg, but we may have gone past it

        // Setup convert power for this block if it has not already been setup
        if (s.convertCapacity[block.number].hasConvertHappenedThisBlock == false) {
            // use capped deltaB for flashloan resistance
            s.convertCapacity[block.number].convertCapacity = uint248(cappedDeltaB);
            s.convertCapacity[block.number].hasConvertHappenedThisBlock = true;
        }

        // calculate how much deltaB convert is happening with this convert
        uint256 convertAmountInDirectionOfPeg = abs(beforeDeltaB.sub(afterDeltaB));

        if (convertAmountInDirectionOfPeg <= s.convertCapacity[block.number].convertCapacity) {
            // all good, you're using less than the available convert power

            // subtract from convert power available for this block
            s.convertCapacity[block.number].convertCapacity -= uint248(convertAmountInDirectionOfPeg);

            return crossoverAmount;
        } else {
            // you're using more than the available convert power

            // penalty will be how far past peg you went, but any remaining convert power is used to reduce the penalty
            uint256 penalty = convertAmountInDirectionOfPeg - s.convertCapacity[block.number].convertCapacity;

            // all convert power for this block is used up
            s.convertCapacity[block.number].convertCapacity = 0;

            return penalty.add(crossoverAmount); // should this be capped at bdvConverted?
        }
    }

    // TODO: when we updated to Solidity 0.8, use the native abs function
    // the verson of OpenZeppelin we're on does not support abs
    function abs(int256 a) internal pure returns (uint256) {
        return a >= 0 ? uint256(a) : uint256(-a);
    }
}
