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
import {C} from "contracts/C.sol";

/**
 * @title LibConvert
 * @author Publius, deadmanwalking
 */
library LibConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;
    using LibWell for address;

    struct convertParams {
        address toToken;
        address fromToken;
        uint256 fromAmount;
        uint256 toAmount;
        address account;
        bool decreaseBDV;
    }

    /**
     * @notice Takes in bytes object that has convert input data encoded into it for a particular convert for
     * a specified pool and returns the in and out convert amounts and token addresses and bdv
     * @param convertData Contains convert input parameters for a specified convert
     * note account and decreaseBDV variables are initialized at the start
     * as address(0) and false respectively and remain that way if a convert is not anti-lambda-lambda
     * If it is anti-lambda, account is the address of the account to update the deposit
     * and decreaseBDV is true
     */
    function convert(bytes calldata convertData)
        external
        returns (convertParams memory cp)
    {
        LibConvertData.ConvertKind kind = convertData.convertKind();

        // if (kind == LibConvertData.ConvertKind.BEANS_TO_CURVE_LP) {
        //     (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibCurveConvert
        //         .convertBeansToLP(convertData);
        if (kind == LibConvertData.ConvertKind.BEANS_TO_WELL_LP) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibWellConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.WELL_LP_TO_BEANS) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibWellConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_BEANS_TO_UNRIPE_LP) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibUnripeConvert
                .convertBeansToLP(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_LP_TO_UNRIPE_BEANS) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibUnripeConvert
                .convertLPToBeans(convertData);
        } else if (kind == LibConvertData.ConvertKind.UNRIPE_TO_RIPE) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibChopConvert
                .convertUnripeToRipe(convertData);
        } else if (kind == LibConvertData.ConvertKind.LAMBDA_LAMBDA) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibLambdaConvert
                .convert(convertData);
        } else if (kind == LibConvertData.ConvertKind.ANTI_LAMBDA_LAMBDA) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount, cp.account, cp.decreaseBDV) = LibLambdaConvert
                .antiConvert(convertData);
        } else if (kind == LibConvertData.ConvertKind.CURVE_LP_TO_BEANS) {
            (cp.toToken, cp.fromToken, cp.toAmount, cp.fromAmount) = LibCurveConvert
                .convertLPToBeans(convertData);
        } else {
            revert("Convert: Invalid payload");
        }
    }

    function getMaxAmountIn(address fromToken, address toToken)
        internal
        view
        returns (uint256)
    {
        /// BEAN:3CRV LP -> BEAN
        if (fromToken == C.CURVE_BEAN_METAPOOL && toToken == C.BEAN)
            return LibCurveConvert.lpToPeg(C.CURVE_BEAN_METAPOOL);
        
        /// BEAN -> BEAN:3CRV LP
        // NOTE: cannot convert due to bean:3crv dewhitelisting
        // if (fromToken == C.BEAN && toToken == C.CURVE_BEAN_METAPOOL)
        //     return LibCurveConvert.beansToPeg(C.CURVE_BEAN_METAPOOL);
        
        // Lambda -> Lambda &
        // Anti-Lambda -> Lambda
        if (fromToken == toToken) 
            return type(uint256).max;

        // Bean -> Well LP Token
        if (fromToken == C.BEAN && toToken.isWell())
            return LibWellConvert.beansToPeg(toToken);

        // Well LP Token -> Bean
        if (fromToken.isWell() && toToken == C.BEAN)
            return LibWellConvert.lpToPeg(fromToken);

        // urLP Convert
        if (fromToken == C.UNRIPE_LP){
            // UrBEANETH -> urBEAN
            if (toToken == C.UNRIPE_BEAN)
                return LibUnripeConvert.lpToPeg();
            // UrBEANETH -> BEANETH
            if (toToken == LibBarnRaise.getBarnRaiseWell())
                return type(uint256).max;
        }

        // urBEAN Convert
        if (fromToken == C.UNRIPE_BEAN){
            // urBEAN -> urLP
            if (toToken == C.UNRIPE_LP)
                return LibUnripeConvert.beansToPeg();
            // UrBEAN -> BEAN
            if (toToken == C.BEAN)
                return type(uint256).max;
        }

        revert("Convert: Tokens not supported");
    }

    function getAmountOut(address fromToken, address toToken, uint256 fromAmount)
        internal
        view
        returns (uint256)
    {
        /// BEAN:3CRV LP -> BEAN
        if (fromToken == C.CURVE_BEAN_METAPOOL && toToken == C.BEAN)
            return LibCurveConvert.getBeanAmountOut(C.CURVE_BEAN_METAPOOL, fromAmount);
        
        /// BEAN -> BEAN:3CRV LP
        // NOTE: cannot convert due to bean:3crv dewhitelisting
        // if (fromToken == C.BEAN && toToken == C.CURVE_BEAN_METAPOOL)
        //     return LibCurveConvert.getLPAmountOut(C.CURVE_BEAN_METAPOOL, fromAmount);

        /// urLP -> urBEAN
        if (fromToken == C.UNRIPE_LP && toToken == C.UNRIPE_BEAN)
            return LibUnripeConvert.getBeanAmountOut(fromAmount);
        
        /// urBEAN -> urLP
        if (fromToken == C.UNRIPE_BEAN && toToken == C.UNRIPE_LP)
            return LibUnripeConvert.getLPAmountOut(fromAmount);
        
        // Lambda -> Lambda &
        // Anti-Lambda -> Lambda
        if (fromToken == toToken)
            return fromAmount;

        // Bean -> Well LP Token
        if (fromToken == C.BEAN && toToken.isWell())
            return LibWellConvert.getLPAmountOut(toToken, fromAmount);

        // Well LP Token -> Bean
        if (fromToken.isWell() && toToken == C.BEAN)
            return LibWellConvert.getBeanAmountOut(fromToken, fromAmount);

        // UrBEAN -> Bean
        if (fromToken == C.UNRIPE_BEAN && toToken == C.BEAN)
            return LibChopConvert.getConvertedUnderlyingOut(fromToken, fromAmount);

        // UrBEANETH -> BEANETH
        if (fromToken == C.UNRIPE_LP && toToken == LibBarnRaise.getBarnRaiseWell())
            return LibChopConvert.getConvertedUnderlyingOut(fromToken, fromAmount);

        revert("Convert: Tokens not supported");
    }
}
