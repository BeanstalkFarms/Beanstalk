// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "./LibConvertData.sol";
import "../Curve/LibBeanMetaCurve.sol";

/**
 * @title LibMetaCurveConvert
 * @author Publius
 */
library LibMetaCurveConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    uint256 constant private N_COINS = 2;
    uint256 constant private FEED2 = 2000000;
    uint256 constant private ADMIN_FEE = 5e9;
    uint256 constant private FEE_DENOMINATOR = 1e10;

    /**
     * @notice Calculate the amount of BEAN that would exist in a Curve metapool
     * if it were "at peg", i.e. if there was 1 BEAN per 1 USD of 3CRV.
     * @dev Assumes that `balances[1]` is 3CRV.
     */
    function beansAtPeg(uint256[2] memory balances)
        internal
        view
        returns (uint256 beans)
    {
        return balances[1].mul(C.curve3Pool().get_virtual_price()).div(1e30);
    }

    /**
     * 
     */
    function lpToPeg(uint256[2] memory balances, uint256 atPeg) internal view returns (uint256 lp) {
        uint256 a = C.curveMetapool().A_precise();
        uint256[2] memory xp = LibBeanMetaCurve.getXP(balances);
        uint256 d0 = LibCurve.getD(xp, a);
        uint256 toPeg = balances[0].sub(atPeg);
        toPeg = toPegWithFee(toPeg, balances, d0, a);
        lp = calcLPTokenAmount(toPeg, balances, d0, a);
    }

    function calcLPTokenAmount(uint256 amount, uint256[2] memory balances, uint256 D0, uint256 a) internal view returns (uint256) {
        balances[0] = balances[0].sub(amount);
        uint256[2] memory xp = LibBeanMetaCurve.getXP(balances);
        uint256 D1 = LibCurve.getD(xp, a);
        uint256 diff = D0.sub(D1);
        return diff.mul(C.curveMetapool().totalSupply()).div(D0);
    }

    function toPegWithFee(uint256 amount, uint256[2] memory balances, uint256 D0, uint256 a) internal view returns (uint256) {
        uint256[2] memory xp = LibBeanMetaCurve.getXP(balances);
        uint256 new_y = LibBeanMetaCurve.getXP0(balances[0].sub(amount));
        uint256 D1 = LibCurve.getD([new_y, xp[1]], a);

        uint256[N_COINS] memory xp_reduced;
        uint256 dx_expected = xp[0].mul(D1).div(D0).sub(new_y);
        xp_reduced[0] = xp[0].sub(FEED2.mul(dx_expected) / FEE_DENOMINATOR);

        dx_expected = xp[1].sub(xp[1].mul(D1).div(D0));
        xp_reduced[1] = xp[1].sub(FEED2.mul(dx_expected) / FEE_DENOMINATOR);

        uint256 yd = LibCurve.getYD(a, 0, xp_reduced, D1);
        uint256 dy = xp_reduced[0].sub(yd);
        dy = LibBeanMetaCurve.getX0(dy.sub(1));
        uint256 dy_0 = LibBeanMetaCurve.getX0(xp[0].sub(new_y));

        return dy_0.add((dy_0.sub(dy)).mul(ADMIN_FEE).div(FEE_DENOMINATOR));
    }
}
