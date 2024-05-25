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
import {C} from "contracts/C.sol";

/**
 * @title LibConvert
 * @author Publius
 */
library LibConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;
    using LibWell for address;

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

        // urBEANETH Convert
        if (tokenIn == C.UNRIPE_LP){
            // UrBEANETH -> urBEAN
            if (tokenOut == C.UNRIPE_BEAN)
                return LibUnripeConvert.lpToPeg();
            // UrBEANETH -> BEANETH
            if (tokenOut == C.BEAN_ETH_WELL)
                return type(uint256).max;
        }

        // urBEAN Convert
        if (tokenIn == C.UNRIPE_BEAN){
            // urBEAN -> urBEANETH LP
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

        /// urBEANETH LP -> urBEAN
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.UNRIPE_BEAN)
            return LibUnripeConvert.getBeanAmountOut(amountIn);
        
        /// urBEAN -> urBEANETH LP
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
        if (tokenIn == C.UNRIPE_LP && tokenOut == C.BEAN_ETH_WELL)
            return LibChopConvert.getConvertedUnderlyingOut(tokenIn, amountIn);

        revert("Convert: Tokens not supported");
    }
}
