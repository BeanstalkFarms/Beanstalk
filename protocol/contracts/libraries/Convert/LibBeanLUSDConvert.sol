/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../Curve/LibMetaCurve.sol";
import "./LibPlainCurveConvert.sol";

/**
 * @author Publius
 * @title Lib Plain Curve Convert
**/
library LibBeanLUSDConvert {

    using SafeMath for uint256;

    //-------------------------------------------------------------------------------------------------------------------
    // Mainnet
    address private constant lusdMetaPool = 0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA;
    uint256 private constant beanDecimals = 6;
    uint256 private constant lusdDecimals = 18;
    //-------------------------------------------------------------------------------------------------------------------
    


    // function beansAtPeg(
    //     uint256[2] memory balances
    // ) internal view returns (uint256 beans) {
    //     return LibPlainCurveConvert.beansAtPeg(
    //         C.curveBeanLUSDAddress(), 
    //         balances,
    //         [C.curveMetapoolAddress(), lusdMetaPool], 
    //         [beanDecimals, lusdDecimals]
    //     );
    // }

}