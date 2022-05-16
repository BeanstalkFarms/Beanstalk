/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibCurveConvert.sol";
import "../../C.sol";
import "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title LibUnripeConvert
 **/
library LibUnripeConvert {
    using LibConvertUserData for bytes;
    using SafeMath for uint256;

    function convertLPToBeans(bytes memory userData)
        internal
        returns (
            address outToken,
            address inToken,
            uint256 outAmount,
            uint256 inAmount,
            uint256 bdv
        )
    {
        outToken = C.unripeBeanAddress();
        inToken = C.unripeLPAddress();
        (uint256 lp, uint256 minBeans) = userData.basicConvert();

        (outAmount, inAmount) = LibCurveConvert._curveRemoveLPAndBuyToPeg(
            unripeToUnderlying(inToken, lp),
            unripeToUnderlying(outToken, minBeans),
            C.curveMetapoolAddress()
        );
        bdv = outAmount;

        outAmount = underlyingToUnripe(outToken, outAmount);
        inAmount = underlyingToUnripe(inToken, inAmount);

        IBean(inToken).burn(inAmount);
        IBean(outToken).mint(address(this), outAmount);
    }

    function convertBeansToLP(bytes memory userData)
        internal
        returns (
            address outToken,
            address inToken,
            uint256 outAmount,
            uint256 inAmount,
            uint256 bdv
        )
    {
        inToken = C.unripeBeanAddress();
        outToken = C.unripeLPAddress();
        (uint256 beans, uint256 minLP) = userData.basicConvert();

        (outAmount, inAmount) = LibCurveConvert._curveSellToPegAndAddLiquidity(
            unripeToUnderlying(inToken, beans),
            unripeToUnderlying(outToken, minLP),
            C.curveMetapoolAddress()
        );

        bdv = inAmount;
        outAmount = underlyingToUnripe(outToken, outAmount);
        inAmount = underlyingToUnripe(inToken, inAmount);

        IBean(inToken).burn(inAmount);
        IBean(outToken).mint(address(this), outAmount);
    }
    
    function unripeToUnderlying(address unripeToken, uint256 unripe)
        internal
        view
        returns (uint256 underlying)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        underlying = s.u[unripeToken].balanceOfUnderlying.mul(unripe).div(
            IBean(unripeToken).totalSupply()
        );
    }

    function underlyingToUnripe(address unripeToken, uint256 underlying)
        private
        view
        returns (uint256 unripe)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unripe = IBean(unripeToken).totalSupply().mul(underlying).div(
            s.u[unripeToken].balanceOfUnderlying
        );
    }

    function beansToPeg() internal view returns (uint256 beans) {
        uint256 underlyingBeans = LibCurveConvert.beansToPeg(C.curveMetapoolAddress());
        beans = underlyingToUnripe(C.unripeBeanAddress(), underlyingBeans);
        
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256 underlyingLP = LibCurveConvert.lpToPeg(C.curveMetapoolAddress());
        lp = underlyingToUnripe(C.unripeLPAddress(), underlyingLP);
    }
}
