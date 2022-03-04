/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../LibConvertUserData.sol";
import "../LibMetaCurve.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib Curve Convert
**/
library LibCurveConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    function beansToPeg() internal view returns (uint256 beans) {
        uint256[2] memory balances = LibMetaCurve.balances();
        return _beansToPeg(balances);
    }

    function _beansToPeg(uint256[2] memory balances) private view returns (uint256 beans) {
        balances = LibMetaCurve.getXP(balances);
        console.log(balances[0]);
        console.log(balances[1]);
        beans = balances[1].sub(balances[0]).div(LibMetaCurve.rateMultiplier());
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256[2] memory balances = LibMetaCurve.balances();
        balances = LibMetaCurve.getXP(balances);
        uint256 beans = balances[0].sub(balances[1]);
    }

    function convertLPToBeans(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 lp, uint256 minBeans) = userData.addBeansInLP();
        (outAmount, inAmount) = _curveRemoveLPAndBuyToPeg(lp, minBeans);
        outToken = C.uniswapV2PairAddress();
        inToken = C.beanAddress();
        bdv = outAmount;
    }

    function convertBeansToLP(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        (uint256 beans, uint256 minLP) = userData.addLPInBeans();
        (outAmount, inAmount) = _curveSellToPegAndAddLiquidity(beans, minLP);
        console.log("Out: %s, In: %s", outAmount, inAmount);
        outToken = C.uniswapV2PairAddress();
        inToken = C.beanAddress();
        bdv = inAmount;
    }

    function _curveSellToPegAndAddLiquidity(uint256 beans, uint256 minLP) private returns (uint256 lp, uint256 beansConverted) {
        uint256[2] memory balances = LibMetaCurve.balances();
        uint256 beans = _beansToPeg(balances);
        uint256 outLP = beans.mul(LibMetaCurve.totalSupply()).div(balances[0]);
        require(outLP > minLP, "Convert: Insufficient output amount");
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = beans;
        lp = LibMetaCurve.addLiquidity(amounts, minLP);
        beansConverted = beans;
    }

    function _curveRemoveLPAndBuyToPeg(uint256 lp, uint256 minBeans) private returns (uint256 beans, uint256 lpConverted) {
        uint256[2] memory balances = LibMetaCurve.balances();
        balances = LibMetaCurve.getXP(balances);
        uint256 beans = balances[0].sub(balances[1]); 
        require(beans > minBeans, "Convert: Insufficient output amount");
        beans = LibMetaCurve.removeLiquidityOneCoin(lp, 0, minBeans);
        lpConverted = lp;
    }
    

    // // Multi-Pool Buy To Peg/Sell To Peg Functions
    // function _convertUniswapBuyToPegAndCurveSellToPeg(bytes memory userData)
    //     private
    //     returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) 
    // {
    //     AppStorage storage s = LibAppStorage.diamondStorage();

    //     (uint256 uniswapLP, uint256 minBeans, uint256 beans, uint256 minCurveLP) = userData.uniswapBuyToPegAndCurveSellToPeg();
    //     (, uint256 inAmount) = _uniswapRemoveLPAndBuyToPeg(uniswapLP, minBeans);
    //     (uint256 outAmount, uint256 bdv) = _curveSellToPegAndAddLiquidity(beans, minCurveLP);
    //     address outToken = C.curveMetapoolAddress();
    //     address inToken = C.uniswapV2PairAddress();
    // }

    // function _convertCurveBuyToPegAndUniswapSellToPeg(bytes memory userData)
    //     private
    //     returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    // {
    //     AppStorage storage s = LibAppStorage.diamondStorage();

    //     (uint256 curveLP, uint256 minBeans, uint256 beans, uint256 minUniswapLP) = userData.curveBuyToPegAndUniswapSellToPeg();
    //     (, uint256 inAmount) = _curveRemoveLPAndBuyToPeg(curveLP, minBeans);
    //     (uint256 outAmount, uint256 bdv) = _uniswapSellToPegAndAddLiquidity(beans, minUniswapLP);
    //     address outToken = C.uniswapV2PairAddress();
    //     address inToken = C.curveMetapoolAddress();
    // }
}
