/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibCurveConvert.sol";
import "./LibUniswapConvert.sol";

/**
 * @author Publius
 * @title Lib Convert
**/
library LibConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    function convert(bytes memory userData)
        internal
        returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    {
        LibConvertUserData.ConvertKind kind = userData.convertKind();

        if (kind == LibConvertUserData.ConvertKind.BEANS_TO_CURVE_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibCurveConvert.convertBeansToLP(userData);
        } else if (kind == LibConvertUserData.ConvertKind.BEANS_TO_UNISWAP_LP) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibUniswapConvert.convertBeansToLP(userData);
        } else if (kind == LibConvertUserData.ConvertKind.CURVE_LP_TO_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibCurveConvert.convertLPToBeans(userData);
        } else if (kind == LibConvertUserData.ConvertKind.UNISWAP_LP_TO_BEANS) {
            (outToken, inToken, outAmount, inAmount, bdv) = LibUniswapConvert.convertLPToBeans(userData);
        } 
        else if (kind == LibConvertUserData.ConvertKind.UNISWAP_BUY_TO_PEG_AND_CURVE_SELL_TO_PEG) {
        //     (outToken, inToken, outAmount, inAmount, bdv) = _convertUniswapBuyToPegAndCurveSellToPeg(userData);
        } else if (kind == LibConvertUserData.ConvertKind.CURVE_BUY_TO_PEG_AND_UNISWAP_SELL_TO_PEG) {
        //     (outToken, inToken, outAmount, inAmount, bdv) = _convertCurveBuyToPegAndUniswapSellToPeg(userData);
        } 

        // else {
        //     _revert(Errors.UNHANDLED_EXIT_KIND);
        // }
    }
}
