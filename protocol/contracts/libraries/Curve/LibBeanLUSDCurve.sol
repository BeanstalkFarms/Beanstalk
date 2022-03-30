/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibMetaCurve.sol";
import "hardhat/console.sol";

interface IPlainCurve {
    function A_precise() external view returns (uint256);
    function get_balances() external view returns (uint256[2] memory);
    function totalSupply() external view returns (uint256);
}

library LibBeanLUSDCurve {
    using SafeMath for uint256;

    uint256 private constant N_COINS = 2;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    address private constant BEAN_METAPOOL = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;
    uint256 private constant BEAN_DECIMALS = 6;
    uint256 private constant BEAN_RM = 1e12;
    uint256 private constant I_BEAN_RM = 1e6;

    address private constant POOL = 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    address private constant TOKEN_METAPOOL = 0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA;
    uint256 private constant TOKEN_DECIMALS = 18;

    function bdv(uint256 amount) internal view returns (uint256) {
        uint256 rate = getRate();
        console.log("Price: %s", rate);
        uint256[2] memory balances = IPlainCurve(POOL).get_balances();
        console.log("B1: %s, B2: %s", balances[0], balances[1]);
        uint256 a = IPlainCurve(POOL).A_precise();
        console.log("A: %s", a);
        uint256[2] memory xp = LibCurve.getXP(balances, BEAN_RM, rate);

        console.log("XP1: %s, XP2: %s", xp[0], xp[1]);
        uint256 d = LibCurve.getD(xp, a);
        console.log("D: %s", d);
        uint256 totalSupply = IPlainCurve(POOL).totalSupply();

// 
        checkD(balances);
        uint256 beanBalance = d.div(2);
        uint256 lusdBalance = beanBalance.mul(1e18).div(rate);
        checkD([beanBalance / 1e12, lusdBalance]);
// 

        return d.mul(amount).div(totalSupply) / 1e12;
    }

    function checkD(uint256[2] memory balances) internal view returns (uint256) {
        uint256 a = IPlainCurve(POOL).A_precise();
        console.log("B1: %s, B2: %s", balances[0], balances[1]);
        uint256[2] memory xp = LibCurve.getXP(balances, BEAN_RM, 1e18);
        console.log("XP1: %s, XP2: %s", xp[0], xp[1]);
        uint256 d = LibCurve.getD(xp, a);
        console.log("check d: %s", d);
    }

    function getRate() internal view returns (uint256 rate) {
        uint256 bean3CrvPrice = LibMetaCurve.price(BEAN_METAPOOL, BEAN_DECIMALS);
        console.log("Bean3Crv: %s",bean3CrvPrice);
        uint256 token3CrvPrice = LibMetaCurve.price(TOKEN_METAPOOL, TOKEN_DECIMALS);
        console.log("LUSD3Crv: %s", token3CrvPrice);
        rate = token3CrvPrice.mul(I_BEAN_RM).div(
            bean3CrvPrice
        );
    }
}
