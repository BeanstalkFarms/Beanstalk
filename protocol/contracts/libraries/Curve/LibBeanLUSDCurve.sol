/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibMetaCurve.sol";

interface IPlainCurve {
    function get_virtual_price() external view returns (uint256);
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
        uint256 price = IPlainCurve(POOL).get_virtual_price();
        if (rate < 1e18) price = price.mul(rate).div(1e18);
        return amount.mul(price).div(1e30);
    }

    function getRate() internal view returns (uint256 rate) {
        uint256 bean3CrvPrice = LibMetaCurve.price(BEAN_METAPOOL, BEAN_DECIMALS);
        uint256 token3CrvPrice = LibMetaCurve.price(TOKEN_METAPOOL, TOKEN_DECIMALS);
        rate = token3CrvPrice.mul(I_BEAN_RM).div(
            bean3CrvPrice
        );
    }
}
