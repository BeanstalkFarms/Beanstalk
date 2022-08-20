/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "./LibConstantProductWell.sol";
import "./LibWellStorage.sol";
import "../LibSafeMath128.sol";
import "../../tokens/ERC20/WellERC20.sol";
import "../Token/LibTransfer.sol";
import "hardhat/console.sol";

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
    event AddLiquidity(address wellId, uint128[] amounts);
    event RemoveLiquidity(address wellId, uint128[] amounts);
    event RemoveLiquidityOneToken(address wellId, IERC20 token, uint128 amount);

    /**
     * Swap
     **/

    function getSwap(
        LibWellStorage.WellInfo calldata w,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx
    ) internal view returns (int256 dy) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        (uint256 i, uint256 j) = getIJ(w.tokens, iToken, jToken);
        (, dy) = _getSwap(w.wellType, w.typeData, ws.balances, i, j, dx);
    }

    function swap(
        LibWellStorage.WellInfo calldata w,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx,
        int256 minDy
    ) internal returns (int256 dy) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        (uint256 i, uint256 j) = getIJ(w.tokens, iToken, jToken);
        (ws.balances, dy) = _getSwap(
            w.wellType,
            w.typeData,
            ws.balances,
            i,
            j,
            dx
        );
        require(dy >= minDy, "LibWell: too much slippage.");
        if (dx < 0)
            emit Swap(w.wellId, jToken, iToken, uint256(-dy), uint256(-dx));
        else
            emit Swap(w.wellId, iToken, jToken, uint256(dx), uint256(dy));
    }

    function _getSwap(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint128[] memory balances,
        uint256 i,
        uint256 j,
        int256 dx
    ) private pure returns (uint128[] memory, int256) {
        uint256 k = getK(wellType, typeData, balances);
        balances[i] = dx > 0
            ? balances[i].add(uint128(dx))
            : balances[i].sub(uint128(-dx));
        uint256 yBefore = balances[j];
        balances[j] = getY(wellType, typeData, i, balances, k);
        int256 dy = int256(yBefore) - int256(balances[j]);
        return (balances, dy);
    }

    /**
     * Add Liquidity
     **/

    function addLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint128[] memory amounts,
        uint256 minAmountOut,
        address recipient,
        LibTransfer.To toMode
    ) internal returns (uint256 amountOut) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 k1 = getK(w.wellType, w.typeData, ws.balances);
        for (uint256 i; i < w.tokens.length; ++i)
            ws.balances[i] = ws.balances[i].add(uint128(amounts[i]));
        uint256 k2 = getK(w.wellType, w.typeData, ws.balances);
        amountOut = k2.sub(k1);
        require(amountOut >= minAmountOut, "LibWell: Not enough LP.");
        LibTransfer.mintToken(IBean(w.wellId), amountOut, recipient, toMode);
        emit AddLiquidity(w.wellId, amounts);
    }

    function getAddLiquidityOut(LibWellStorage.WellInfo calldata w, uint128[] memory amounts)
        internal
        view
        returns (uint256 amountOut)
    {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 k1 = getK(w.wellType, w.typeData, ws.balances);
        uint128[] memory balances = new uint128[](w.tokens.length);
        for (uint256 i; i < w.tokens.length; ++i)
            balances[i] = ws.balances[i].add(uint128(amounts[i]));
        uint256 k2 = getK(w.wellType, w.typeData, balances);
        amountOut = k2.sub(k1);
    }

    /**
     * Remove Liquidity
     **/

    function removeLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256 lpAmountIn,
        uint128[] calldata minTokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint128[] memory tokenAmountsOut) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 k = getK(w.wellType, w.typeData, ws.balances);
        tokenAmountsOut = new uint128[](w.tokens.length);
        for (uint256 i; i < w.tokens.length; ++i) {
            tokenAmountsOut[i] = uint128(lpAmountIn.mul(ws.balances[i]).div(k)); // Downcasting ok because lpAmountIn <= k
            ws.balances[i] = ws.balances[i].sub(tokenAmountsOut[i]);
            require(
                tokenAmountsOut[i] >= minTokenAmountsOut[i],
                "LibWell: Not enough out."
            );
        }
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(w.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityOut(LibWellStorage.WellInfo calldata w, uint256 lpAmountIn)
        internal
        view
        returns (uint128[] memory tokenAmountsOut)
    {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 k = getK(w.wellType, w.typeData, ws.balances);
        tokenAmountsOut = new uint128[](w.tokens.length);
        for (uint256 i; i < w.tokens.length; ++i) {
            tokenAmountsOut[i] = uint128(lpAmountIn.mul(ws.balances[i]).div(k));
        }
    }

    /**
     * Remove Liquidity One Token
     **/

    function removeLiquidityOneToken(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn,
        uint256 minTokenAmountOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint128 tokenAmountOut) {
        uint128 y;
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 i = getI(w.tokens, token);
        (tokenAmountOut, y) = _getRemoveLiquidityOneTokenOut(w, ws, i, lpAmountIn);
        require(tokenAmountOut >= minTokenAmountOut, "LibWell: out too low.");
        ws.balances[i] = y;
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidityOneToken(w.wellId, token, tokenAmountOut);
    }

    function getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn
    ) internal view returns (uint256 tokenAmountOut) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        uint256 i = getI(w.tokens, token);
        (tokenAmountOut, ) = _getRemoveLiquidityOneTokenOut(w, ws, i, lpAmountIn);
    }

    function _getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        LibWellStorage.WellState storage ws,
        uint256 i,
        uint256 lpAmountIn
    ) private view returns (uint128 tokenAmountOut, uint128 y) {
        uint256 k = getK(w.wellType, w.typeData, ws.balances);
        k = k.sub(lpAmountIn, "LibWell: too much LP");
        y = getY(w.wellType, w.typeData, i, ws.balances, k);
        tokenAmountOut = ws.balances[i].sub(y);
    }

    /**
     * Remove Liquidity Imbalanced
     **/

    function removeLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256 maxLPAmountIn,
        uint128[] calldata tokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256 lpAmountIn) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        (lpAmountIn, ws.balances) = _getRemoveLiquidityImbalanced(w, ws.balances, tokenAmountsOut);
        require(lpAmountIn <= maxLPAmountIn, "LibWell: in too high.");
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(w.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint128[] calldata tokenAmountsOut
    ) internal view returns (uint256 lpAmountIn) {
        LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
        (lpAmountIn, ) = _getRemoveLiquidityImbalanced(w, ws.balances, tokenAmountsOut);
    }

    function _getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint128[] memory balances,
        uint128[] calldata tokenAmountsOut
    ) private pure returns (uint256, uint128[] memory) {
        uint256 k1 = getK(w.wellType, w.typeData, balances);
        for (uint i; i < w.tokens.length; ++i) {
            balances[i] = balances[i].sub(tokenAmountsOut[i]);
        }
        uint256 k2 = getK(w.wellType, w.typeData, balances);
        return (k1.sub(k2), balances);
    }

    /**
     * Internal
     **/

    function getIJ(
        IERC20[] memory tokens,
        IERC20 fromToken,
        IERC20 toToken
    ) private pure returns (uint256, uint256) {
        return fromToken == tokens[1] ? (1, 0) : (0, 1);
    }

    function getI(
        IERC20[] memory tokens,
        IERC20 token
    ) private pure returns (uint256) {
        return token == tokens[1] ? 1 : 0;
    }

    function getK(
        LibWellStorage.WellType wellType,
        bytes memory typeData,
        uint128[] memory balances
    ) internal pure returns (uint256) {
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            return LibConstantProductWell.getK(balances);
        revert("LibWell: Well type not supported");
    }

    function getY(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint256 i,
        uint128[] memory xs,
        uint256 k
    ) private pure returns (uint128) {
        uint256 y;
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            y = LibConstantProductWell.getY(i, xs, k);
        else revert("LibWell: Well type not supported");
        require(y < type(uint128).max, "LibWell: y too high");
        return uint128(y);
    }

    // function record(
    //     LibWellStorage.WellInfo calldata p
    // ) internal {
    //     LibWellStorage.WellState storage ws = LibWellStorage.wellState(w);
    //     uint128 passedTime = block.timestamp - ws.lastTimestamp; // ws.lastTimestamp <= block.timestamp
    //     if (passedTime > 0) {
    //         for (uint i; i < w.tokens.length; ++i) {
    //             uint128[] memory balances = ws.balances;
    //             ws.cumulativeBalances[0] = ws.cumulativeBalances[0].add(balances[0].mul(passedTime));
    //             ws.cumulativeBalances[1] = ws.cumulativeBalances[1].add(balances[1].mul(passedTime));
    //         }
    //         ws.lastTimestamp = block.timestamp;
    //     }
    // }
}
