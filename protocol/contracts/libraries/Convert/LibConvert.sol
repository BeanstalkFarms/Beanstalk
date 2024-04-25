// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import {LibCurveConvert} from "./LibCurveConvert.sol";
import {LibUnripeConvert} from "./LibUnripeConvert.sol";
import {LibLambdaConvert} from "./LibLambdaConvert.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibWellConvert} from "./LibWellConvert.sol";
import {LibChopConvert} from "./LibChopConvert.sol";
import {LibWell} from "contracts/libraries/Well/LibWell.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {AppStorage, LibAppStorage, Storage} from "contracts/libraries/LibAppStorage.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
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

    struct DeltaBStorage {
        int256 beforeInputTokenDeltaB;
        int256 afterInputTokenDeltaB;
        int256 beforeOutputTokenDeltaB;
        int256 afterOutputTokenDeltaB;
        int256 beforeOverallDeltaB;
        int256 afterOverallDeltaB;
    }

    struct StalkPenaltyData {
        uint256 overallAmountInDirectionOfPeg;
        uint256 inputTokenAmountInDirectionOfPeg;
        uint256 outputTokenAmountInDirectionOfPeg;
        uint256 overallAmountAgainstPeg;
        uint256 overallCrossoverAmount;
        uint256 inputTokenAmountAgainstPeg;
        uint256 inputTokenCrossoverAmount;
        uint256 outputTokenAmountAgainstPeg;
        uint256 outputTokenCrossoverAmount;
        uint256 higherAmountAgainstPeg;
        uint256 higherInputTokenCrossoverAmount;
        uint256 convertCapacityPenalty;
    }

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
     */
    function calculateStalkPenalty(
        DeltaBStorage memory dbs,
        uint256 bdvConverted,
        uint256 overallConvertCapacity,
        address inputToken,
        address outputToken
    ) internal returns (uint256 stalkPenaltyBdv) {
        StalkPenaltyData memory spd;

        spd.overallAmountInDirectionOfPeg = calculateConvertedTowardsPeg(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);
        spd.inputTokenAmountInDirectionOfPeg = calculateConvertedTowardsPeg(dbs.beforeInputTokenDeltaB, dbs.afterInputTokenDeltaB);
        spd.outputTokenAmountInDirectionOfPeg = calculateConvertedTowardsPeg(dbs.beforeOutputTokenDeltaB, dbs.afterOutputTokenDeltaB);

        (spd.overallAmountAgainstPeg, spd.overallCrossoverAmount) = calculateAmountAgainstPegAndCrossover(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);
        (spd.inputTokenAmountAgainstPeg, spd.inputTokenCrossoverAmount) = calculateAmountAgainstPegAndCrossover(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);
        (spd.outputTokenAmountAgainstPeg, spd.outputTokenCrossoverAmount) = calculateAmountAgainstPegAndCrossover(dbs.beforeOverallDeltaB, dbs.afterOverallDeltaB);

        spd.higherAmountAgainstPeg = Math.max(spd.overallAmountAgainstPeg, spd.inputTokenAmountAgainstPeg.add(spd.outputTokenAmountAgainstPeg));
        spd.higherInputTokenCrossoverAmount = Math.max(spd.overallCrossoverAmount, spd.inputTokenCrossoverAmount.add(spd.outputTokenCrossoverAmount));

        spd.convertCapacityPenalty = calculateConvertCapacityPenalty(overallConvertCapacity, spd.overallAmountInDirectionOfPeg, inputToken, spd.inputTokenAmountInDirectionOfPeg, outputToken, spd.outputTokenAmountInDirectionOfPeg);

        stalkPenaltyBdv = Math.min(spd.higherAmountAgainstPeg.add(spd.higherInputTokenCrossoverAmount).add(spd.convertCapacityPenalty), bdvConverted);
    }

    function calculateAmountAgainstPegAndCrossover(int256 beforeDeltaB, int256 afterDeltaB) internal pure returns (uint256 amountAgainstPeg, uint256 crossoverAmount) {
        amountAgainstPeg = abs(afterDeltaB.sub(beforeDeltaB));

        // Check if the signs of beforeDeltaB and afterDeltaB are different,
        // indicating that deltaB has crossed zero
        if ((beforeDeltaB > 0 && afterDeltaB < 0) || (beforeDeltaB < 0 && afterDeltaB > 0)) {
            // Calculate how far past peg we went - this is just abs of new deltaB
            crossoverAmount = abs(afterDeltaB);
        }
    }

    function calculateConvertCapacityPenalty(
        uint256 overallCappedDeltaB,
        uint256 overallAmountInDirectionOfPeg,
        address inputToken,
        uint256 inputTokenAmountInDirectionOfPeg,
        address outputToken,
        uint256 outputTokenAmountInDirectionOfPeg
    ) internal returns (uint256 cumulativePenalty) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        Storage.ConvertCapacity storage convertCap = s.convertCapacity[block.number];
        
        // first check overall convert capacity, if none remaining then full penalty for amount in direction of peg
        if (convertCap.overallConvertCapacityUsed >= overallCappedDeltaB) {
            return overallAmountInDirectionOfPeg;
        }
        
        // update overall remaining convert capacity
        convertCap.overallConvertCapacityUsed = convertCap.overallConvertCapacityUsed.add(overallAmountInDirectionOfPeg);


        // add to penalty how far past capacity was used
        if (convertCap.overallConvertCapacityUsed > overallCappedDeltaB) {
            cumulativePenalty = overallCappedDeltaB.sub(convertCap.overallConvertCapacityUsed);
        }

        // update per-well convert capacity

        if (inputToken != C.BEAN && inputTokenAmountInDirectionOfPeg > 0) {
            uint256 inputTokenWellCapacity = abs(LibWellMinting.cappedReservesDeltaB(inputToken));
            convertCap.wellConvertCapacityUsed[inputToken] = convertCap.wellConvertCapacityUsed[inputToken].add(inputTokenAmountInDirectionOfPeg);
            if (convertCap.wellConvertCapacityUsed[inputToken] > inputTokenWellCapacity) {
                cumulativePenalty = cumulativePenalty.add(convertCap.wellConvertCapacityUsed[inputToken].sub(inputTokenWellCapacity));
            }
        }

        if (outputToken != C.BEAN && outputTokenAmountInDirectionOfPeg > 0) {
            uint256 outputTokenWellCapacity = abs(LibWellMinting.cappedReservesDeltaB(outputToken));
            convertCap.wellConvertCapacityUsed[outputToken] = convertCap.wellConvertCapacityUsed[outputToken].add(outputTokenAmountInDirectionOfPeg);
            if (convertCap.wellConvertCapacityUsed[outputToken] > outputTokenWellCapacity) {
                cumulativePenalty = cumulativePenalty.add(convertCap.wellConvertCapacityUsed[outputToken].sub(outputTokenWellCapacity));
            }
        }

        if (cumulativePenalty > overallAmountInDirectionOfPeg) {
            cumulativePenalty = overallAmountInDirectionOfPeg; // perhaps not necessary to cap since stalkPenaltyBdv is capped by bdvConverted?
        }
    }

    /**
     * @notice Takes before/after deltaB's and calculates how much was converted towards, but not past, peg.
     */
    function calculateConvertedTowardsPeg(int256 beforeTokenDeltaB, int256 afterTokenDeltaB) internal pure returns (uint256) {
        // Calculate absolute values of beforeInputTokenDeltaB and afterInputTokenDeltaB using the abs() function
        uint256 beforeDeltaAbs = abs(beforeTokenDeltaB);
        uint256 afterDeltaAbs = abs(afterTokenDeltaB);
        
        // Check if afterInputTokenDeltaB and beforeInputTokenDeltaB have the same sign
        if ((beforeTokenDeltaB >= 0 && afterTokenDeltaB >= 0) || (beforeTokenDeltaB < 0 && afterTokenDeltaB < 0)) {
            // If they have the same sign, compare the absolute values
            if (afterDeltaAbs < beforeDeltaAbs) {
                // Return the difference between beforeDeltaAbs and afterDeltaAbs
                return beforeDeltaAbs.sub(afterDeltaAbs);
            } else {
                // If afterInputTokenDeltaB is further from or equal to zero, return zero
                return 0;
            }
        } else {
            // This means it crossed peg, return how far it went towards peg, which is the abs of input token deltaB
            return beforeDeltaAbs;
        }
    }

    // TODO: when we updated to Solidity 0.8, use the native abs function
    // the verson of OpenZeppelin we're on does not support abs
    function abs(int256 a) internal pure returns (uint256) {
        return a >= 0 ? uint256(a) : uint256(-a);
    }
}
