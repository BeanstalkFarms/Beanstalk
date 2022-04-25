/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./LibMetaCurve.sol";
import "hardhat/console.sol";

library LibBeanMetaCurve {
    using SafeMath for uint256;

    uint256 private constant A_PRECISION = 100;
    address private constant POOL = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
    address private constant CRV3_POOL = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    uint256 private constant N_COINS  = 2;
    uint256 private constant RATE_MULTIPLIER = 1e12; // Bean has 6 Decimals
    uint256 private constant PRECISION = 1e18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    function bdv(uint256 amount) internal view returns (uint256) {
        // By using previous balances and the virtual price, we protect against flash loan
        console.log(1);
        uint256[2] memory balances = IMeta3Curve(POOL).get_previous_balances();
        console.log("PB: %s, %s", balances[0], balances[1]);
        uint256 virtualPrice = IMeta3Curve(POOL).get_virtual_price();
        console.log("vp: %s", virtualPrice);
        uint256[2] memory xp = LibMetaCurve.getXP(balances, RATE_MULTIPLIER);
        console.log("xp: %s, %s", xp[0], xp[1]);
        uint256 a = IMeta3Curve(POOL).A_precise();
        uint256 D = LibCurve.getD(xp, a);
        uint256 price = LibCurve.getPrice(xp, a, D, RATE_MULTIPLIER);
        console.log("Price: %s", price);
        uint256 totalSupply =  D * PRECISION / virtualPrice;
        uint256 beanValue = balances[0].mul(amount).div(totalSupply);
        uint256 curveValue = xp[1].mul(amount).div(totalSupply).div(price);
        return beanValue.add(curveValue);
    }

    function getDFromBalances(uint256[2] memory balances) internal view returns (uint) {
        return LibMetaCurve.getDFromBalances(POOL, balances, RATE_MULTIPLIER);
    }

    function getXP(uint256[2] memory balances) internal view returns (uint256[2] memory xp) {
        return LibMetaCurve.getXP(balances, RATE_MULTIPLIER);
    }
}
