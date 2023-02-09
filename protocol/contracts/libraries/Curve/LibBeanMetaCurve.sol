// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibMetaCurve, IMeta3Curve} from "./LibMetaCurve.sol";
import {LibCurve} from "./LibCurve.sol";
import "~/C.sol";

/**
 * @title LibBeanMetaCurve
 * @author Publius
 * @notice Calculates BDV and deltaB for the BEAN:3CRV Metapool.
 */
library LibBeanMetaCurve {
    using SafeMath for uint256;

    uint256 private constant RATE_MULTIPLIER = 1e12; // Bean has 6 Decimals => 1e(18 - delta decimals)
    uint256 private constant PRECISION = 1e18;
    uint256 private constant i = 0;
    uint256 private constant j = 1;

    //////////////////// GETTERS ////////////////////

    /**
     * @param amount An amount of the BEAN:3CRV LP token.
     * @dev Calculates the current BDV of BEAN given the balances in the BEAN:3CRV
     * Metapool. NOTE: assumes that `balances[0]` is BEAN.
     */
    function bdv(uint256 amount) internal view returns (uint256) {
        // By using previous balances and the virtual price, we protect against flash loan
        uint256[2] memory balances = IMeta3Curve(C.CURVE_BEAN_METAPOOL).get_previous_balances();
        uint256 virtualPrice = C.curveMetapool().get_virtual_price();
        uint256[2] memory xp = LibMetaCurve.getXP(balances, RATE_MULTIPLIER);

        uint256 a = C.curveMetapool().A_precise();
        uint256 D = LibCurve.getD(xp, a);
        uint256 price = LibCurve.getPrice(xp, a, D, RATE_MULTIPLIER);
        uint256 totalSupply = (D * PRECISION) / virtualPrice;
        uint256 beanValue = balances[0].mul(amount).div(totalSupply);
        uint256 curveValue = xp[1].mul(amount).div(totalSupply).div(price);
        
        return beanValue.add(curveValue);
    }

    function getDeltaB() internal view returns (int256 deltaB) {
        uint256[2] memory balances = C.curveMetapool().get_balances();
        uint256 d = getDFroms(balances);
        deltaB = getDeltaBWithD(balances[0], d);
    }
    
    function getDeltaBWithD(uint256 balance, uint256 D)
        internal
        pure
        returns (int256 deltaB)
    {
        uint256 pegBeans = D / 2 / RATE_MULTIPLIER;
        deltaB = int256(pegBeans) - int256(balance);
    }

    //////////////////// CURVE HELPERS ////////////////////

    /**
     * @dev D = the number of LP tokens times the virtual price.
     * LP supply = D / virtual price. D increases as pool accumulates fees.
     * D = number of stable tokens in the pool when the pool is balanced. 
     * 
     * Rate multiplier for BEAN is 1e12.
     * Rate multiplier for 3CRV is virtual price.
     */
    function getDFroms(uint256[2] memory balances)
        internal
        view
        returns (uint256)
    {
        return LibMetaCurve.getDFroms(
            C.CURVE_BEAN_METAPOOL,
            balances,
            RATE_MULTIPLIER
        );
    }

    /**
     * @dev `xp = balances * RATE_MULTIPLIER`
     */
    function getXP(uint256[2] memory balances)
        internal
        view
        returns (uint256[2] memory xp)
    {
        xp = LibMetaCurve.getXP(balances, RATE_MULTIPLIER);
    }

    /**
     * @dev Convert from `balance` -> `xp0`, which is scaled up by `RATE_MULTIPLIER`.
     */
    function getXP0(uint256 balance)
        internal
        pure
        returns (uint256 xp0)
    {
        xp0 = balance.mul(RATE_MULTIPLIER);
    }

    /**
     * @dev Convert from `xp0` -> `balance`, which is scaled down by `RATE_MULTIPLIER`.
     */
    function getX0(uint256 xp0)
        internal
        pure
        returns (uint256 balance0)
    {
        balance0 = xp0.div(RATE_MULTIPLIER);
    }
}
