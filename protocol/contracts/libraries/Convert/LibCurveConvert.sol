// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICurvePool} from "~/interfaces/ICurve.sol";
import "../LibAppStorage.sol";
import "./LibConvertData.sol";
import "./LibMetaCurveConvert.sol";
import "../Curve/LibBeanMetaCurve.sol";
import "~/libraries/LibInternal.sol";

/**
 * @title LibCurveConvert
 * @author Publius
 */
library LibCurveConvert {
    using SafeMath for uint256;
    using LibConvertData for bytes;

    //////////////////// GETTERS ////////////////////

    /**
     * @notice Calculate the number of BEAN needed to be added as liquidity to return `pool` back to peg.
     * @dev
     *   Assumes that BEAN is the first token in the pool.
     *   Returns 0 if returns peg.
     */
    function beansToPeg(address pool) internal view returns (uint256 beans) {
        uint256[2] memory balances = ICurvePool(pool).get_balances();
        uint256 xp1 = _getBeansAtPeg(pool, balances);
        if (xp1 <= balances[0]) return 0;
        beans = xp1.sub(balances[0]);
    }

    /**
     * @notice Calculate the amount of liquidity needed to be removed as Beans to return `pool` back to peg.
     * @dev Returns 0 if above peg.
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
     * @notice Decodes convert data and increasing deltaB by removing liquidity as Beans.
     * @param convertData Contains convert input parameters for a Curve AddLPInBeans convert
     */
    function convertLPToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        (uint256 lp, uint256 minBeans, address pool) = convertData
            .convertWithAddress();
        LibInternal.mow(msg.sender, C.curveMetapoolAddress());
        (amountOut, amountIn) = curveRemoveLPAndBuyToPeg(lp, minBeans, pool);
        tokenOut = C.beanAddress();
        tokenIn = pool;
    }

    /**
     * @notice Decodes convert data and decreases deltaB by adding Beans as 1-sided liquidity.
     * @param convertData Contains convert input parameters for a Curve AddBeansInLP convert
     */
    function convertBeansToLP(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 amountOut,
            uint256 amountIn
        )
    {
        LibInternal.mow(msg.sender, C.beanAddress());
        (uint256 beans, uint256 minLP, address pool) = convertData
            .convertWithAddress();
        (amountOut, amountIn) = curveSellToPegAndAddLiquidity(
            beans,
            minLP,
            pool
        );
        tokenOut = pool;
        tokenIn = C.BEAN;
    }

    //////////////////// CURVE CONVERT: LOGIC ////////////////////

    /**
     * @notice Increase deltaB by adding Beans as liquidity via Curve.
     * @dev deltaB <≈ 0 after the convert
     * @param beans The amount of beans to convert to Curve LP
     * @param minLP The minimum amount of Curve LP to receive
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
     * @notice Decrease deltaB by removing LP as Beans via Curve.
     * @dev deltaB >≈ 0 after the convert
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
