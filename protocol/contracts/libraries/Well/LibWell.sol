/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "./LibWellStorage.sol";
import "../LibSafeMath128.sol";
import "../../tokens/ERC20/WellERC20.sol";
import "./Well2/LibWell2.sol";
import "./WellN/LibWellN.sol";

/**
 * @author Publius
 * @title Lib Well
 **/
library LibWell {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    event RegisterWellType(LibWellStorage.WellType wellType, string[] parameterTypes);
    event CreateWell(
        address wellId,
        IERC20[] tokens,
        LibWellStorage.WellType wellType,
        bytes typeData,
        bytes32 wellHash
    );
    event UpdateWell(
        address wellId,
        LibWellStorage.WellType newWellType,
        bytes newTypeData,
        bytes32 oldWellHash,
        bytes32 newWellHash
    );
    event Swap(
        address wellId,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        uint256 toAmount
    );
    event AddLiquidity(address wellId, uint256[] amounts);
    event RemoveLiquidity(address wellId, uint256[] amounts);
    event RemoveLiquidityOneToken(address wellId, IERC20 token, uint256 amount);

    /**
     * Swap
     **/

    function getSwap(
        LibWellStorage.WellInfo calldata w,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx
    ) internal view returns (int256 dy) {
        if (w.tokens.length == 2) return LibWell2.getSwap(w, iToken, jToken, dx);
        return LibWellN.getSwap(w, iToken, jToken, dx);
    }

    // By using a negative dx and 
    function swap(
        LibWellStorage.WellInfo calldata w,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx,
        int256 minDy
    ) internal returns (int256 dy) {
        if (w.tokens.length == 2) return LibWell2.swap(w, iToken, jToken, dx, minDy);
        return LibWellN.swap(w, iToken, jToken, dx, minDy);
    }

    /**
     * Add Liquidity
     **/

    function addLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256[] memory amounts,
        uint256 minAmountOut,
        address recipient,
        LibTransfer.To toMode
    ) internal returns (uint256 amountOut) {
        if (w.tokens.length == 2) return LibWell2.addLiquidity(w, amounts, minAmountOut, recipient, toMode);
        return LibWellN.addLiquidity(w, amounts, minAmountOut, recipient, toMode);
    }

    function getAddLiquidityOut(LibWellStorage.WellInfo calldata w, uint256[] memory amounts)
        internal
        view
        returns (uint256 amountOut)
    {
        if (w.tokens.length == 2) return LibWell2.getAddLiquidityOut(w, amounts);
        return LibWellN.getAddLiquidityOut(w, amounts);
    }

    /**
     * Remove Liquidity
     **/

    function removeLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256 lpAmountIn,
        uint256[] calldata minTokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256[] memory tokenAmountsOut) {
        if (w.tokens.length == 2) return LibWell2.removeLiquidity(w, lpAmountIn, minTokenAmountsOut, recipient, fromMode);
        return LibWellN.removeLiquidity(w, lpAmountIn, minTokenAmountsOut, recipient, fromMode);
    }

    function getRemoveLiquidityOut(LibWellStorage.WellInfo calldata w, uint256 lpAmountIn)
        internal
        view
        returns (uint256[] memory tokenAmountsOut)
    {
        if (w.tokens.length == 2) return LibWell2.getRemoveLiquidityOut(w, lpAmountIn);
        return LibWellN.getRemoveLiquidityOut(w, lpAmountIn);
    }

    // /**
    //  * Remove Liquidity One Token
    //  **/

    function removeLiquidityOneToken(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn,
        uint256 minTokenAmountOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256 tokenAmountOut) {
        if (w.tokens.length == 2) return LibWell2.removeLiquidityOneToken(w, token, lpAmountIn, minTokenAmountOut, recipient, fromMode);
        return LibWellN.removeLiquidityOneToken(w, token, lpAmountIn, minTokenAmountOut, recipient, fromMode);
    }

    function getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn
    ) internal view returns (uint256 tokenAmountOut) {
        if (w.tokens.length == 2) return LibWell2.getRemoveLiquidityOneTokenOut(w, token, lpAmountIn);
        return LibWellN.getRemoveLiquidityOneTokenOut(w, token, lpAmountIn);
    }

    /**
     * Remove Liquidity Imbalanced
     **/

    function removeLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256 maxLPAmountIn,
        uint256[] calldata tokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256 lpAmountIn) {
        if (w.tokens.length == 2) return LibWell2.removeLiquidityImbalanced(w, maxLPAmountIn, tokenAmountsOut, recipient, fromMode);
        return LibWellN.removeLiquidityImbalanced(w, maxLPAmountIn, tokenAmountsOut, recipient, fromMode);
    }

    function getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256[] calldata tokenAmountsOut
    ) internal view returns (uint256 lpAmountIn) {
        if (w.tokens.length == 2) return LibWell2.getRemoveLiquidityImbalanced(w, tokenAmountsOut);
        return LibWellN.getRemoveLiquidityImbalanced(w, tokenAmountsOut);
    }

    function getK(
        LibWellStorage.WellType wellType,
        bytes memory typeData,
        uint128[] memory balances
    ) internal pure returns (uint256) {
        if (balances.length == 2) 
            return LibWell2.getK(wellType, typeData, uint112(balances[0]), uint112(balances[1]));
        return LibWellN.getK(wellType, typeData, balances);
    }
}
