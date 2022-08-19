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
        LibWellStorage.WellInfo calldata p,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx
    ) internal view returns (int256 dy) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        (uint256 i, uint256 j) = getIJ(p.tokens, iToken, jToken);
        (, dy) = _getSwap(p.wellType, p.typeData, ps.balances, i, j, dx);
    }

    function swap(
        LibWellStorage.WellInfo calldata p,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx,
        int256 minDy
    ) internal returns (int256 dy) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        (uint256 i, uint256 j) = getIJ(p.tokens, iToken, jToken);
        (ps.balances, dy) = _getSwap(
            p.wellType,
            p.typeData,
            ps.balances,
            i,
            j,
            dx
        );
        require(dy >= minDy, "LibWell: too much slippage.");
        if (dx < 0)
            emit Swap(p.wellId, jToken, iToken, uint256(-dy), uint256(-dx));
        else
            emit Swap(p.wellId, iToken, jToken, uint256(dx), uint256(dy));
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
        LibWellStorage.WellInfo calldata p,
        uint128[] memory amounts,
        uint256 minAmountOut,
        address recipient,
        LibTransfer.To toMode
    ) internal returns (uint256 amountOut) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 k1 = getK(p.wellType, p.typeData, ps.balances);
        for (uint256 i; i < p.tokens.length; ++i)
            ps.balances[i] = ps.balances[i].add(uint128(amounts[i]));
        uint256 k2 = getK(p.wellType, p.typeData, ps.balances);
        amountOut = k2.sub(k1);
        require(amountOut >= minAmountOut, "LibWell: Not enough LP.");
        LibTransfer.mintToken(IBean(p.wellId), amountOut, recipient, toMode);
        emit AddLiquidity(p.wellId, amounts);
    }

    function getAddLiquidityOut(LibWellStorage.WellInfo calldata p, uint128[] memory amounts)
        internal
        view
        returns (uint256 amountOut)
    {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 k1 = getK(p.wellType, p.typeData, ps.balances);
        uint128[] memory balances = new uint128[](p.tokens.length);
        for (uint256 i; i < p.tokens.length; ++i)
            balances[i] = ps.balances[i].add(uint128(amounts[i]));
        uint256 k2 = getK(p.wellType, p.typeData, balances);
        amountOut = k2.sub(k1);
    }

    /**
     * Remove Liquidity
     **/

    function removeLiquidity(
        LibWellStorage.WellInfo calldata p,
        uint256 lpAmountIn,
        uint128[] calldata minTokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint128[] memory tokenAmountsOut) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 k = getK(p.wellType, p.typeData, ps.balances);
        tokenAmountsOut = new uint128[](p.tokens.length);
        for (uint256 i; i < p.tokens.length; ++i) {
            tokenAmountsOut[i] = uint128(lpAmountIn.mul(ps.balances[i]).div(k)); // Downcasting ok because lpAmountIn <= k
            ps.balances[i] = ps.balances[i].sub(tokenAmountsOut[i]);
            require(
                tokenAmountsOut[i] >= minTokenAmountsOut[i],
                "LibWell: Not enough out."
            );
        }
        LibTransfer.burnToken(IBean(p.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(p.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityOut(LibWellStorage.WellInfo calldata p, uint256 lpAmountIn)
        internal
        view
        returns (uint128[] memory tokenAmountsOut)
    {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 k = getK(p.wellType, p.typeData, ps.balances);
        tokenAmountsOut = new uint128[](p.tokens.length);
        for (uint256 i; i < p.tokens.length; ++i) {
            tokenAmountsOut[i] = uint128(lpAmountIn.mul(ps.balances[i]).div(k));
        }
    }

    /**
     * Remove Liquidity One Token
     **/

    function removeLiquidityOneToken(
        LibWellStorage.WellInfo calldata p,
        IERC20 token,
        uint256 lpAmountIn,
        uint256 minTokenAmountOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint128 tokenAmountOut) {
        uint128 y;
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 i = getI(p.tokens, token);
        (tokenAmountOut, y) = _getRemoveLiquidityOneTokenOut(p, ps, i, lpAmountIn);
        require(tokenAmountOut >= minTokenAmountOut, "LibWell: out too low.");
        ps.balances[i] = y;
        LibTransfer.burnToken(IBean(p.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidityOneToken(p.wellId, token, tokenAmountOut);
    }

    function getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata p,
        IERC20 token,
        uint256 lpAmountIn
    ) internal view returns (uint256 tokenAmountOut) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        uint256 i = getI(p.tokens, token);
        (tokenAmountOut, ) = _getRemoveLiquidityOneTokenOut(p, ps, i, lpAmountIn);
    }

    function _getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata p,
        LibWellStorage.WellState storage ps,
        uint256 i,
        uint256 lpAmountIn
    ) private view returns (uint128 tokenAmountOut, uint128 y) {
        uint256 k = getK(p.wellType, p.typeData, ps.balances);
        k = k.sub(lpAmountIn, "LibWell: too much LP");
        y = getY(p.wellType, p.typeData, i, ps.balances, k);
        tokenAmountOut = ps.balances[i].sub(y);
    }

    /**
     * Remove Liquidity Imbalanced
     **/

    function removeLiquidityImbalanced(
        LibWellStorage.WellInfo calldata p,
        uint256 maxLPAmountIn,
        uint128[] calldata tokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256 lpAmountIn) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        (lpAmountIn, ps.balances) = _getRemoveLiquidityImbalanced(p, ps.balances, tokenAmountsOut);
        require(lpAmountIn <= maxLPAmountIn, "LibWell: in too high.");
        LibTransfer.burnToken(IBean(p.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(p.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata p,
        uint128[] calldata tokenAmountsOut
    ) internal view returns (uint256 lpAmountIn) {
        LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
        (lpAmountIn, ) = _getRemoveLiquidityImbalanced(p, ps.balances, tokenAmountsOut);
    }

    function _getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata p,
        uint128[] memory balances,
        uint128[] calldata tokenAmountsOut
    ) private pure returns (uint256, uint128[] memory) {
        uint256 k1 = getK(p.wellType, p.typeData, balances);
        for (uint i; i < p.tokens.length; ++i) {
            balances[i] = balances[i].sub(tokenAmountsOut[i]);
        }
        uint256 k2 = getK(p.wellType, p.typeData, balances);
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
    //     LibWellStorage.WellState storage ps = LibWellStorage.wellState(p);
    //     uint128 passedTime = block.timestamp - ps.lastTimestamp; // ps.lastTimestamp <= block.timestamp
    //     if (passedTime > 0) {
    //         for (uint i; i < p.tokens.length; ++i) {
    //             uint128[] memory balances = ps.balances;
    //             ps.cumulativeBalances[0] = ps.cumulativeBalances[0].add(balances[0].mul(passedTime));
    //             ps.cumulativeBalances[1] = ps.cumulativeBalances[1].add(balances[1].mul(passedTime));
    //         }
    //         ps.lastTimestamp = block.timestamp;
    //     }
    // }
}
