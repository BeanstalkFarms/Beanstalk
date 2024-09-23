// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {IBean} from "contracts/interfaces/IBean.sol";
import {LibWellConvert} from "./LibWellConvert.sol";
import {LibUnripe} from "../LibUnripe.sol";
import {LibConvertData} from "./LibConvertData.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibBarnRaise} from "contracts/libraries/LibBarnRaise.sol";
import {LibAppStorage, AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibUnripeConvert
 * @author Publius
 */
library LibUnripeConvert {
    using LibConvertData for bytes;
    using LibRedundantMath256 for uint256;

    function convertLPToBeans(
        bytes memory convertData
    ) internal returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        tokenOut = s.sys.tokens.urBean;
        tokenIn = s.sys.tokens.urLp;
        (uint256 lp, uint256 minBeans) = convertData.basicConvert();
        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minBeans, IBean(s.sys.tokens.urBean).totalSupply())
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
        (uint256 outUnderlyingAmount, uint256 inUnderlyingAmount) = LibWellConvert
            ._wellRemoveLiquidityTowardsPeg(
                LibUnripe.unripeToUnderlying(tokenIn, lp, IBean(s.sys.tokens.urLp).totalSupply()),
                minAmountOut,
                LibBarnRaise.getBarnRaiseWell()
            );

        amountIn = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(amountIn);

        amountOut = LibUnripe
            .underlyingToUnripe(tokenOut, outUnderlyingAmount)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), amountOut);
    }

    function convertBeansToLP(
        bytes memory convertData
    ) internal returns (address tokenOut, address tokenIn, uint256 amountOut, uint256 amountIn) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        tokenIn = s.sys.tokens.urBean;
        tokenOut = s.sys.tokens.urLp;
        (uint256 beans, uint256 minLP) = convertData.basicConvert();
        uint256 minAmountOut = LibUnripe
            .unripeToUnderlying(tokenOut, minLP, IBean(s.sys.tokens.urLp).totalSupply())
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
        (uint256 outUnderlyingAmount, uint256 inUnderlyingAmount) = LibWellConvert
            ._wellAddLiquidityTowardsPeg(
                LibUnripe.unripeToUnderlying(
                    tokenIn,
                    beans,
                    IBean(s.sys.tokens.urBean).totalSupply()
                ),
                minAmountOut,
                LibBarnRaise.getBarnRaiseWell()
            );

        amountIn = LibUnripe.underlyingToUnripe(tokenIn, inUnderlyingAmount);
        LibUnripe.removeUnderlying(tokenIn, inUnderlyingAmount);
        IBean(tokenIn).burn(amountIn);

        amountOut = LibUnripe
            .underlyingToUnripe(tokenOut, outUnderlyingAmount)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
        LibUnripe.addUnderlying(tokenOut, outUnderlyingAmount);
        IBean(tokenOut).mint(address(this), amountOut);
    }

    function beansToPeg() internal view returns (uint256 beans) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 underlyingBeans = LibWellConvert.beansToPeg(LibBarnRaise.getBarnRaiseWell());
        beans = LibUnripe.underlyingToUnripe(s.sys.tokens.urBean, underlyingBeans);
    }

    function lpToPeg() internal view returns (uint256 lp) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 underlyingLP = LibWellConvert.lpToPeg(LibBarnRaise.getBarnRaiseWell());
        lp = LibUnripe.underlyingToUnripe(s.sys.tokens.urLp, underlyingLP);
    }

    function getLPAmountOut(uint256 amountIn) internal view returns (uint256 lp) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 beans = LibUnripe.unripeToUnderlying(
            s.sys.tokens.urBean,
            amountIn,
            IBean(s.sys.tokens.urBean).totalSupply()
        );
        lp = LibWellConvert.getLPAmountOut(LibBarnRaise.getBarnRaiseWell(), beans);
        lp = LibUnripe
            .underlyingToUnripe(s.sys.tokens.urLp, lp)
            .mul(LibUnripe.percentLPRecapped())
            .div(LibUnripe.percentBeansRecapped());
    }

    function getBeanAmountOut(uint256 amountIn) internal view returns (uint256 bean) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 lp = LibUnripe.unripeToUnderlying(
            s.sys.tokens.urLp,
            amountIn,
            IBean(s.sys.tokens.urBean).totalSupply()
        );
        bean = LibWellConvert.getBeanAmountOut(LibBarnRaise.getBarnRaiseWell(), lp);
        bean = LibUnripe
            .underlyingToUnripe(s.sys.tokens.urBean, bean)
            .mul(LibUnripe.percentBeansRecapped())
            .div(LibUnripe.percentLPRecapped());
    }
}
