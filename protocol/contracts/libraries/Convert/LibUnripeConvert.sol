/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibCurveConvert.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";
import "../LibUnripe.sol";
import "~/libraries/LibInternal.sol";

/**
 * @author Publius
 * @title LibUnripeConvert
 **/
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
        tokenOut = C.unripeBeanAddress();
        tokenIn = C.unripeLPAddress();
        LibInternal.mow(msg.sender, tokenIn);
        (uint256 lp, uint256 minBeans) = convertData.basicConvert();

        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minBeans)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());

        (
            uint256 outUnderlyingAmount,
            uint256 inUnderlyingAmount
        ) = LibCurveConvert._curveRemoveLPAndBuyToPeg(
                LibUnripe.unripeToUnderlying(tokenIn, lp),
                minAmountOut,
                C.curveMetapoolAddress()
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
        tokenIn = C.unripeBeanAddress();
        tokenOut = C.unripeLPAddress();
        LibInternal.mow(msg.sender, tokenIn);
        (uint256 beans, uint256 minLP) = convertData.basicConvert();

        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minLP)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());

        (
            uint256 outUnderlyingAmount,
            uint256 inUnderlyingAmount
        ) = LibCurveConvert._curveSellToPegAndAddLiquidity(
                LibUnripe.unripeToUnderlying(tokenIn, beans),
                minAmountOut,
                C.curveMetapoolAddress()
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
            C.curveMetapoolAddress()
        );
        beans = LibUnripe.underlyingToUnripe(
            C.unripeBeanAddress(),
            underlyingBeans
        );
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256 underlyingLP = LibCurveConvert.lpToPeg(
            C.curveMetapoolAddress()
        );
        lp = LibUnripe.underlyingToUnripe(C.unripeLPAddress(), underlyingLP);
    }

    function getLPAmountOut(uint256 amountIn)
        internal
        view
        returns (uint256 lp)
    {
        uint256 beans = LibUnripe.unripeToUnderlying(
            C.unripeBeanAddress(),
            amountIn
        );
        lp = LibCurveConvert.getLPAmountOut(C.curveMetapoolAddress(), beans);
        lp = LibUnripe
            .underlyingToUnripe(C.unripeLPAddress(), lp)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
    }

    function getBeanAmountOut(uint256 amountIn)
        internal
        view
        returns (uint256 bean)
    {
        uint256 lp = LibUnripe.unripeToUnderlying(
            C.unripeLPAddress(),
            amountIn
        );
        bean = LibCurveConvert.getBeanAmountOut(C.curveMetapoolAddress(), lp);
        bean = LibUnripe
            .underlyingToUnripe(C.unripeBeanAddress(), bean)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
    }
}
