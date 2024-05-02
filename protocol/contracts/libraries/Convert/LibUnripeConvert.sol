// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibWellConvert} from "./LibWellConvert.sol";
import {LibUnripe} from "../LibUnripe.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";

/**
 * @title LibUnripeConvert
 * @author Publius
 */
library LibUnripeConvert {
    using LibConvertData for bytes;

    function convertLPToBeans(
        bytes memory convertData
    ) internal returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        tokenOut = C.UNRIPE_BEAN;
        tokenIn = C.UNRIPE_LP;
        (uint256 lp, uint256 minBeans) = convertData.basicConvert();
        uint256 minAmountOut = (LibUnripe.unripeToUnderlying(
            tokenOut,
            minBeans,
            IBean(C.UNRIPE_BEAN).totalSupply()
        ) * LibUnripe.percentLPRecapped()) / LibUnripe.percentBeansRecapped();
        (uint256 outUnderlyingAmount, uint256 inUnderlyingAmount) = LibWellConvert
            ._wellRemoveLiquidityTowardsPeg(
                LibUnripe.unripeToUnderlying(tokenIn, lp, IBean(C.UNRIPE_LP).totalSupply()),
                minAmountOut,
                LibBarnRaise.getBarnRaiseWell()
            );

        amountIn = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(amountIn);

        amountOut =
            (LibUnripe.underlyingToUnripe(tokenOut, outUnderlyingAmount) *
                LibUnripe.percentBeansRecapped()) /
            LibUnripe.percentLPRecapped();
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), amountOut);
    }

    function convertBeansToLP(
        bytes memory convertData
    ) internal returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        tokenIn = C.UNRIPE_BEAN;
        tokenOut = C.UNRIPE_LP;
        (uint256 beans, uint256 minLP) = convertData.basicConvert();
        uint256 minAmountOut = (LibUnripe.unripeToUnderlying(
            tokenOut,
            minLP,
            IBean(C.UNRIPE_LP).totalSupply()
        ) * LibUnripe.percentBeansRecapped()) / LibUnripe.percentLPRecapped();
        (uint256 outUnderlyingAmount, uint256 inUnderlyingAmount) = LibWellConvert
            ._wellAddLiquidityTowardsPeg(
                LibUnripe.unripeToUnderlying(tokenIn, beans, IBean(C.UNRIPE_BEAN).totalSupply()),
                minAmountOut,
                LibBarnRaise.getBarnRaiseWell()
            );

        amountIn = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(amountIn);

        amountOut =
            (LibUnripe.underlyingToUnripe(tokenOut, outUnderlyingAmount) *
                LibUnripe.percentLPRecapped()) /
            LibUnripe.percentBeansRecapped();
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), amountOut);
    }

    function beansToPeg() internal view returns (uint256 beans) {
        uint256 underlyingBeans = LibWellConvert.beansToPeg(LibBarnRaise.getBarnRaiseWell());
        beans = LibUnripe.underlyingToUnripe(C.UNRIPE_BEAN, underlyingBeans);
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256 underlyingLP = LibWellConvert.lpToPeg(LibBarnRaise.getBarnRaiseWell());
        lp = LibUnripe.underlyingToUnripe(C.UNRIPE_LP, underlyingLP);
    }

    function getLPAmountOut(uint256 amountIn) internal view returns (uint256 lp) {
        uint256 beans = LibUnripe.unripeToUnderlying(
            C.UNRIPE_BEAN,
            amountIn,
            IBean(C.UNRIPE_BEAN).totalSupply()
        );
        lp = LibWellConvert.getLPAmountOut(LibBarnRaise.getBarnRaiseWell(), beans);
        lp =
            (LibUnripe.underlyingToUnripe(C.UNRIPE_LP, lp) * LibUnripe.percentLPRecapped()) /
            LibUnripe.percentBeansRecapped();
    }

    function getBeanAmountOut(uint256 amountIn) internal view returns (uint256 bean) {
        uint256 lp = LibUnripe.unripeToUnderlying(
            C.UNRIPE_LP,
            amountIn,
            IBean(C.UNRIPE_BEAN).totalSupply()
        );
        bean = LibWellConvert.getBeanAmountOut(LibBarnRaise.getBarnRaiseWell(), lp);
        bean =
            (LibUnripe.underlyingToUnripe(C.UNRIPE_BEAN, bean) * LibUnripe.percentBeansRecapped()) /
            LibUnripe.percentLPRecapped();
    }
}
