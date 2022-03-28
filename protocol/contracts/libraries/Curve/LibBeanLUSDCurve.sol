/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibMetaCurve.sol";

interface IPlainCurve {
    function A_precise() external view returns (uint256);
    function get_balances() external view returns (uint256[2] memory);
    function totalSupply() external view returns (uint256);
}

library LibBeanPlainCurve {
    using SafeMath for uint256;

    uint256 private constant N_COINS = 2;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    address private constant BEAN_METAPOOL = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;
    uint256 private constant BEAN_DECIMALS = 6;
    uint256 private constant BEAN_RM = 1e12;

    address private constant POOL = 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    address private constant TOKEN_METAPOOL = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;
    uint256 private constant TOKEN_DECIMALS = 18;
    uint256 private constant PADDING = 1e12;

    function bdv(uint256 amount) internal view returns (uint256) {
        uint256 rate = getRate();
        uint256[2] memory balances = IPlainCurve(POOL).get_balances();
        uint256 a = IPlainCurve(POOL).A_precise();
        uint256[2] memory xp = LibCurve.getXP(balances, BEAN_RM, getRate());
        uint256 d = LibCurve.getD(xp, a);
        uint256 totalSupply = IPlainCurve(POOL).totalSupply();
        // How to get reserves at specific price
    }

    function getRate() internal view returns (uint256 rate) {
        uint256 bean3CrvPrice = LibMetaCurve.price(BEAN_METAPOOL, BEAN_DECIMALS);
        uint256 token3CrvPrice = LibMetaCurve.price(TOKEN_METAPOOL, TOKEN_DECIMALS);
        rate = token3CrvPrice.mul(bean3CrvPrice).div(
            PADDING
        );
    }
}
