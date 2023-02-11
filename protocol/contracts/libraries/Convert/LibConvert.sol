// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibCurveConvert} from "./LibCurveConvert.sol";
import {LibUnripeConvert} from "./LibUnripeConvert.sol";
import {LibLambdaConvert} from "./LibLambdaConvert.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {C} from "~/C.sol";

/**
 * @title LibConvert
 * @author Publius
 */
library LibConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    /**
     * @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
     * a specified pool and returns the in and out convert amounts and token addresses and bdv
     * @param convertData Contains convert input parameters for a specified convert
     */
    function convert(bytes calldata convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        LibConvertData.ConvertKind kind = convertData.convertKind();

        if (kind == LibConvertData.ConvertKind.BEANS_TO_CURVE_LP) {
            (tokenOut, tokenIn, outAmount, inAmount) = LibCurveConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.CURVE_LP_TO_BEANS) {
            (tokenOut, tokenIn, outAmount, inAmount) = LibCurveConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_BEANS_TO_UNRIPE_LP) {
            (tokenOut, tokenIn, outAmount, inAmount) = LibUnripeConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_LP_TO_UNRIPE_BEANS) {
            (tokenOut, tokenIn, outAmount, inAmount) = LibUnripeConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            (tokenOut, tokenIn, outAmount, inAmount) = LibLambdaConvert
                .convert(convertData);
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
        if (tokenIn == C.BEAN && tokenOut == C.CURVE_BEAN_METAPOOL)
            return LibCurveConvert.beansToPeg(C.CURVE_BEAN_METAPOOL);
        
        /// urBEAN:3CRV LP -> urBEAN
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.UNRIPE_BEAN)
            return LibUnripeConvert.lpToPeg();

        /// urBEAN -> urBEAN:3CRV LP
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.UNRIPE_LP)
            return LibUnripeConvert.beansToPeg();

        // Lambda -> Lambda
        if (tokenIn == tokenOut) 
            return type(uint256).max;

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
        if (tokenIn == C.BEAN && tokenOut == C.CURVE_BEAN_METAPOOL)
            return LibCurveConvert.getLPAmountOut(C.CURVE_BEAN_METAPOOL, amountIn);

        /// urBEAN:3CRV LP -> urBEAN
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.UNRIPE_BEAN)
            return LibUnripeConvert.getBeanAmountOut(amountIn);
        
        /// urBEAN -> urBEAN:3CRV LP
        if (tokenIn == C.UNRIPE_BEAN && tokenOut == C.UNRIPE_LP)
            return LibUnripeConvert.getLPAmountOut(amountIn);
        
        // Lambda -> Lambda
        if (tokenIn == tokenOut)
            return amountIn;

        revert("Convert: Tokens not supported");
    }
}
