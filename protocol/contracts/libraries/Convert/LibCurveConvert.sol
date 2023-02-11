// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICurvePool} from "~/interfaces/ICurve.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibMetaCurveConvert} from "./LibMetaCurveConvert.sol";
import {LibBeanMetaCurve} from "../Curve/LibBeanMetaCurve.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {C} from "~/C.sol";

/**
 * @title LibCurveConvert
 * @author Publius
 * @dev FIXME: `tokenOut` vs. `outAmount` throughout this file
 */
library LibCurveConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    //////////////////// GETTERS ////////////////////

    /**
     * @notice Calculate the number of BEAN needed to return `pool` back to peg.
     * @dev Assumes that BEAN is the first token in the pool.
     */
    function beansToPeg(address pool) internal view returns (uint256 beans) {
        uint256[2] memory balances = ICurvePool(pool).get_balances();
        uint256 xp1 = _getBeansAtPeg(pool, balances);
        if (xp1 <= balances[0]) return 0;
        beans = xp1.sub(balances[0]);
    }

    /**
     * @notice Calculate the amount of LP needed to return `pool` back to peg.
     */
    function lpToPeg(address pool) internal view returns (uint256 lp) {
        uint256[2] memory balances = ICurvePool(pool).get_balances();
        uint256 xp1 = _getBeansAtPeg(pool, balances);
        if (balances[0] <= xp1) return 0;
        return LibMetaCurveConvert.lpToPeg(balances, xp1);
    }

    /**
     * @param pool The address of the Curve pool where `amountIn` will be withdrawn
     * @param amountIn The amount of the LP token of `pool` to remove as BEAN
     * @return beans The amount of BEAN received for removing `amountIn` LP tokens.
     * @dev Assumes that i=0 corresponds to BEAN.
     */
    function getBeanAmountOut(address pool, uint256 amountIn) internal view returns(uint256 beans) {
        beans = ICurvePool(pool).calc_withdraw_one_coin(amountIn, 0); // i=0 -> BEAN
    }

    /**
     * @param pool The address of the Curve pool where `amountIn` will be deposited
     * @param amountIn The amount of BEAN to deposit into `pool`
     * @return lp The amount of LP received for depositing BEAN.
     * @dev Assumes that i=0 corresponds to BEAN.
     */
    function getLPAmountOut(address pool, uint256 amountIn) internal view returns(uint256 lp) {
        lp = ICurvePool(pool).calc_token_amount([amountIn, 0], true); // i=0 -> BEAN
    }

    //////////////////// CURVE CONVERT: KINDS ////////////////////

    /**
     * @notice Takes in encoded bytes for adding Curve LP in beans, extracts the input data, and then calls the
     * @param convertData Contains convert input parameters for a Curve AddLPInBeans convert
     */
    function convertLPToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (uint256 lp, uint256 minBeans, address pool) = convertData
            .convertWithAddress();
        (outAmount, inAmount) = curveRemoveLPAndBuyToPeg(lp, minBeans, pool);
        tokenOut = C.BEAN;
        tokenIn = pool; // The Curve metapool also issues the LP token
    }

    /**
     * @notice Takes in encoded bytes for adding beans in Curve LP, extracts the input data, 
     * @param convertData Contains convert input parameters for a Curve AddBeansInLP convert
     */
    function convertBeansToLP(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        (uint256 beans, uint256 minLP, address pool) = convertData
            .convertWithAddress();
        (outAmount, inAmount) = curveSellToPegAndAddLiquidity(
            beans,
            minLP,
            pool
        );
        tokenOut = pool;
        tokenIn = C.BEAN;
    }

    //////////////////// CURVE CONVERT: LOGIC ////////////////////

    /**
     * @notice Converts Beans into LP via Curve.
     * @param beans The mount of beans to convert to Curve LP
     * @param minLP The min amount of Curve LP to receive
     * @param pool The address of the Curve pool to add to
     */
    function curveSellToPegAndAddLiquidity(
        uint256 beans,
        uint256 minLP,
        address pool
    ) internal returns (uint256 lp, uint256 beansConverted) {
        uint256 beansTo = beansToPeg(pool);
        require(beansTo > 0, "Convert: P must be >= 1.");
        beansConverted = beans > beansTo ? beansTo : beans;
        lp = ICurvePool(pool).add_liquidity([beansConverted, 0], minLP);
    }

    /**
     * @notice Removes LP into Beans via Curve.
     * @param lp The amount of Curve LP to be removed
     * @param minBeans The minimum amount of Beans to receive
     * @param pool The address of the Curve pool to remove from
     */
    function curveRemoveLPAndBuyToPeg(
        uint256 lp,
        uint256 minBeans,
        address pool
    ) internal returns (uint256 beans, uint256 lpConverted) {
        uint256 lpTo = lpToPeg(pool);
        require(lpTo > 0, "Convert: P must be < 1.");
        lpConverted = lp > lpTo ? lpTo : lp;
        beans = ICurvePool(pool).remove_liquidity_one_coin(
            lpConverted,
            0,
            minBeans
        );
    }

    //////////////////// INTERNAL ////////////////////
    
    function _getBeansAtPeg(
        address pool,
        uint256[2] memory balances
    ) internal view returns (uint256) {
        if (pool == C.CURVE_BEAN_METAPOOL) {
            return LibMetaCurveConvert.beansAtPeg(balances);
        }

        revert("Convert: Not a whitelisted Curve pool.");
    }
}
