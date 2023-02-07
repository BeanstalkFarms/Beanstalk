// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibUnripeConvert.sol";
import "./LibLambdaConvert.sol";

/**
 * @title LibConvert
 * @author Publius
 */
library LibConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    /// @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
    ///         a specified pool and returns the in and out convert amounts and token addresses and bdv
    /// @param convertData Contains convert input parameters for a specified convert
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
        returns (uint256 amountIn)
    {
        /// BEAN:3CRV LP -> BEAN
        if (tokenIn == C.curveMetapoolAddress() && tokenOut == C.beanAddress())
            return LibCurveConvert.lpToPeg(C.curveMetapoolAddress());
        
        /// BEAN -> BEAN:3CRV LP
        if (tokenIn == C.beanAddress() && tokenOut == C.curveMetapoolAddress())
            return LibCurveConvert.beansToPeg(C.curveMetapoolAddress());
        
        /// urBEAN:3CRV LP -> urBEAN
        if (tokenIn == C.unripeLPAddress() && tokenOut == C.unripeBeanAddress())
            return LibUnripeConvert.lpToPeg();

        /// urBEAN -> urBEAN:3CRV LP
        if (tokenIn == C.unripeBeanAddress() && tokenOut == C.unripeLPAddress())
            return LibUnripeConvert.beansToPeg();

        // Lambda -> Lambda
        if (tokenIn == tokenOut) return type(uint256).max;

        require(false, "Convert: Tokens not supported");
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        internal 
        view
        returns (uint256 amountOut)
    {
        /// BEAN:3CRV LP -> BEAN
        if (tokenIn == C.curveMetapoolAddress() && tokenOut == C.beanAddress())
            return LibCurveConvert.getBeanAmountOut(C.curveMetapoolAddress(), amountIn);
        
        /// BEAN -> BEAN:3CRV LP
        if (tokenIn == C.beanAddress() && tokenOut == C.curveMetapoolAddress())
            return LibCurveConvert.getLPAmountOut(C.curveMetapoolAddress(), amountIn);

        /// urBEAN:3CRV LP -> urBEAN
        if (tokenIn == C.unripeLPAddress() && tokenOut == C.unripeBeanAddress())
            return LibUnripeConvert.getBeanAmountOut(amountIn);
        
        /// urBEAN -> urBEAN:3CRV LP
        if (tokenIn == C.unripeBeanAddress() && tokenOut == C.unripeLPAddress())
            return LibUnripeConvert.getLPAmountOut(amountIn);
        
        // Lambda -> Lambda
        if (tokenIn == tokenOut) return amountIn;

        require(false, "Convert: Tokens not supported");
    }
}
