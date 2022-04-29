/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "./LibConvertUserData.sol";
import "../Curve/LibBeanMetaCurve.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib Curve Convert
**/
library LibMetaCurveConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;


    function beansAtPeg(uint256[2] memory balances) internal view returns (uint256 beans) {
        return balances[1].mul(C.curve3Pool().get_virtual_price()).div(1e30);
    }

    // function beansToPeg() internal view returns (uint256 beans) {
    //     uint256[2] memory balances = C.curveMetapool().get_balances();
    //     uint256 xp1 = balances[1].mul(C.curve3Pool().get_virtual_price()).div(1e30);
    //     if (xp1 <= balances[0]) return 0;
    //     beans = xp1.sub(balances[0]);
    // }

    // function lpToPeg() internal view returns (uint256 lp) {
    //     uint256[2] memory balances = C.curveMetapool().get_balances();
    //     uint256 xp1 = balances[1].mul(C.curve3Pool().get_virtual_price()).div(1e30);
    //     if (balances[0] <= xp1) return 0;
    //     lp = C.curveMetapool().calc_token_amount([balances[0].sub(xp1), 0], false);
    // }

}