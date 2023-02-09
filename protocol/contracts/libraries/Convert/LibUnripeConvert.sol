// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibCurveConvert.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";
import "../LibUnripe.sol";

/**
 * @title LibUnripeConvert
 * @author Publius
 */
library LibUnripeConvert {
    using LibConvertData for bytes;
    using SafeMath for uint256;

    function convertLPToBeans(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        tokenOut = C.UNRIPE_BEAN;
        tokenIn = C.UNRIPE_LP;
        (uint256 lp, uint256 minBeans) = convertData.basicConvert();

        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minBeans)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());

        (
            uint256 outUnderlyingAmount,
            uint256 inUnderlyingAmount
        ) = LibCurveConvert.curveRemoveLPAndBuyToPeg(
                LibUnripe.unripeToUnderlying(tokenIn, lp),
                minAmountOut,
                C.CURVE_BEAN_METAPOOL
            );

        inAmount = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(inAmount);

        outAmount = LibUnripe
            .underlyingToUnripe(tokenOut, outUnderlyingAmount)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), outAmount);
    }

    function convertBeansToLP(bytes memory convertData)
        internal
        returns (
            address tokenOut,
            address tokenIn,
            uint256 outAmount,
            uint256 inAmount
        )
    {
        tokenIn = C.UNRIPE_BEAN;
        tokenOut = C.UNRIPE_LP;
        (uint256 beans, uint256 minLP) = convertData.basicConvert();

        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minLP)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());

        (
            uint256 outUnderlyingAmount,
            uint256 inUnderlyingAmount
        ) = LibCurveConvert.curveSellToPegAndAddLiquidity(
                LibUnripe.unripeToUnderlying(tokenIn, beans),
                minAmountOut,
                C.CURVE_BEAN_METAPOOL
            );

        inAmount = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(inAmount);

        outAmount = LibUnripe
            .underlyingToUnripe(tokenOut, outUnderlyingAmount)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), outAmount);
    }

    function beansToPeg() internal view returns (uint256 beans) {
        uint256 underlyingBeans = LibCurveConvert.beansToPeg(
            C.CURVE_BEAN_METAPOOL
        );
        beans = LibUnripe.underlyingToUnripe(
            C.UNRIPE_BEAN,
            underlyingBeans
        );
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256 underlyingLP = LibCurveConvert.lpToPeg(
            C.CURVE_BEAN_METAPOOL
        );
        lp = LibUnripe.underlyingToUnripe(C.UNRIPE_LP, underlyingLP);
    }

    function getLPAmountOut(uint256 amountIn)
        internal
        view
        returns (uint256 lp)
    {
        uint256 beans = LibUnripe.unripeToUnderlying(
            C.UNRIPE_BEAN,
            amountIn
        );
        lp = LibCurveConvert.getLPAmountOut(C.CURVE_BEAN_METAPOOL, beans);
        lp = LibUnripe
            .underlyingToUnripe(C.UNRIPE_LP, lp)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
    }

    function getBeanAmountOut(uint256 amountIn)
        internal
        view
        returns (uint256 bean)
    {
        uint256 lp = LibUnripe.unripeToUnderlying(
            C.UNRIPE_LP,
            amountIn
        );
        bean = LibCurveConvert.getBeanAmountOut(C.CURVE_BEAN_METAPOOL, lp);
        bean = LibUnripe
            .underlyingToUnripe(C.UNRIPE_BEAN, bean)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
    }
}
