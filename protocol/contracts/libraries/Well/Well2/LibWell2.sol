/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../../C.sol";
import "./LibConstantProductWell2.sol";
import "../LibWellStorage.sol";
import "../../LibSafeMath128.sol";
import "../../LibSafeMath112.sol";
import "../../../tokens/ERC20/WellERC20.sol";
import "../../Token/LibTransfer.sol";

/**
 * @author Publius
 * @title Lib Well2
 **/
library LibWell2 {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;
    using LibSafeMath112 for uint112;

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
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        (uint112 balanceI, uint112 balanceJ) = w.tokens[0] == iToken ? (ws.balance0, ws.balance1) : (ws.balance1, ws.balance0);
        (,, dy) = _getSwap(w.wellType, w.typeData, balanceI, balanceJ, dx);
    }

    function swap(
        LibWellStorage.WellInfo calldata w,
        IERC20 iToken,
        IERC20 jToken,
        int256 dx,
        int256 minDy
    ) internal returns (int256 dy) {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        (uint112 balanceI, uint112 balanceJ) = w.tokens[0] == iToken ? (ws.balance0, ws.balance1) : (ws.balance1, ws.balance0);
        (balanceI, balanceJ, dy) = _getSwap(
            w.wellType,
            w.typeData,
            balanceI,
            balanceJ,
            dx
        );
        require(dy >= minDy, "LibWell: too much slippage.");
        (ws.balance0, ws.balance1) = w.tokens[0] == iToken ? (balanceI, balanceJ) : (balanceJ, balanceI);
        if (dx < 0)
            emit Swap(w.wellId, jToken, iToken, uint256(-dy), uint256(-dx));
        else
            emit Swap(w.wellId, iToken, jToken, uint256(dx), uint256(dy));
    }

    function _getSwap(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint112 balanceI,
        uint112 balanceJ,
        int256 dx
    ) private pure returns (uint112, uint112, int256) {
        uint256 k = getK(wellType, typeData, balanceI, balanceJ);
        balanceI = dx > 0
            ? balanceI.add(uint112(dx))
            : balanceI.sub(uint112(-dx));
        uint256 yBefore = balanceJ;
        balanceJ = getY(wellType, typeData, balanceI, k);
        int256 dy = int256(yBefore) - int256(balanceJ);
        return (balanceI, balanceJ, dy);
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
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        uint256 k1 = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        ws.balance0 = ws.balance0.add(uint112(amounts[0]));
        ws.balance1 = ws.balance1.add(uint112(amounts[1]));
        uint256 k2 = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        amountOut = k2.sub(k1);
        require(amountOut >= minAmountOut, "LibWell: Not enough LP.");
        LibTransfer.mintToken(IBean(w.wellId), amountOut, recipient, toMode);
        emit AddLiquidity(w.wellId, amounts);
    }

    function getAddLiquidityOut(LibWellStorage.WellInfo calldata w, uint256[] memory amounts)
        internal
        view
        returns (uint256 amountOut)
    {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        uint256 k1 = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        uint112 balance0 = ws.balance0.add(uint112(amounts[0]));
        uint112 balance1 = ws.balance1.add(uint112(amounts[1]));
        uint256 k2 = getK(w.wellType, w.typeData, balance0, balance1);
        amountOut = k2.sub(k1);
    }

    // /**
    //  * Remove Liquidity
    //  **/

    function removeLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256 lpAmountIn,
        uint256[] calldata minTokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256[] memory tokenAmountsOut) {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        uint256 k = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        tokenAmountsOut = new uint256[](2);

        tokenAmountsOut[0] = lpAmountIn.mul(ws.balance0).div(k); // Downcasting ok because lpAmountIn <= k
        ws.balance0 = ws.balance0.sub(uint112(tokenAmountsOut[0]));
        tokenAmountsOut[1] = lpAmountIn.mul(ws.balance1).div(k); // Downcasting ok because lpAmountIn <= k
        ws.balance1 = ws.balance1.sub(uint112(tokenAmountsOut[1]));

        require(
            tokenAmountsOut[0] >= minTokenAmountsOut[0] &&
            tokenAmountsOut[1] >= minTokenAmountsOut[1],
            "LibWell: Not enough out."
        );
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(w.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityOut(LibWellStorage.WellInfo calldata w, uint256 lpAmountIn)
        internal
        view
        returns (uint256[] memory tokenAmountsOut)
    {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        uint256 k = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        tokenAmountsOut = new uint256[](2);
        tokenAmountsOut[0] = lpAmountIn.mul(ws.balance0).div(k); // Downcasting ok because lpAmountIn <= k
        tokenAmountsOut[1] = lpAmountIn.mul(ws.balance1).div(k); // Downcasting ok because lpAmountIn <= k
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
        uint112 y;
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        if (token == w.tokens[0]) {
            (tokenAmountOut, y) = _getRemoveLiquidityOneTokenOut(w, ws, ws.balance0, lpAmountIn);
            ws.balance0 = y;
        } else {
            (tokenAmountOut, y) = _getRemoveLiquidityOneTokenOut(w, ws, ws.balance1, lpAmountIn);
            ws.balance1 = y;
        }
        require(tokenAmountOut >= minTokenAmountOut, "LibWell: out too low.");
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidityOneToken(w.wellId, token, tokenAmountOut);
    }

    function getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn
    ) internal view returns (uint256 tokenAmountOut) {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        (tokenAmountOut, ) = _getRemoveLiquidityOneTokenOut(w, ws, w.tokens[0]==token ? ws.balance0 : ws.balance1, lpAmountIn);
    }

    function _getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        LibWellStorage.Well2State storage ws,
        uint112 balanceI,
        uint256 lpAmountIn
    ) private view returns (uint256 tokenAmountOut, uint112 y) {
        uint256 k = getK(w.wellType, w.typeData, ws.balance0, ws.balance1);
        k = k.sub(lpAmountIn, "LibWell: too much LP");
        y = getY(w.wellType, w.typeData, balanceI, k);
        tokenAmountOut = balanceI.sub(y);
    }

    // /**
    //  * Remove Liquidity Imbalanced
    //  **/

    function removeLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256 maxLPAmountIn,
        uint256[] calldata tokenAmountsOut,
        address recipient,
        LibTransfer.From fromMode
    ) internal returns (uint256 lpAmountIn) {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        (lpAmountIn, ws.balance0, ws.balance1) = _getRemoveLiquidityImbalanced(w, ws.balance0, ws.balance1, tokenAmountsOut);
        require(lpAmountIn <= maxLPAmountIn, "LibWell: in too high.");
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit RemoveLiquidity(w.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256[] calldata tokenAmountsOut
    ) internal view returns (uint256 lpAmountIn) {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        (lpAmountIn,,) = _getRemoveLiquidityImbalanced(w, ws.balance0, ws.balance1, tokenAmountsOut);
    }

    function _getRemoveLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint112 balance0,
        uint112 balance1,
        uint256[] calldata tokenAmountsOut
    ) private pure returns (uint256, uint112, uint112) {
        uint256 k1 = getK(w.wellType, w.typeData, balance0, balance1);
        balance0 = balance0.sub(uint112(tokenAmountsOut[0]));
        balance1 = balance1.sub(uint112(tokenAmountsOut[1]));
        uint256 k2 = getK(w.wellType, w.typeData, balance0, balance1);
        return (k1.sub(k2), balance0, balance1);
    }

    /**
     * Internal
     **/

    function getK(
        LibWellStorage.WellType wellType,
        bytes memory typeData,
        uint112 x0,
        uint112 x1
    ) internal pure returns (uint256) {
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            return LibConstantProductWell2.getK(x0, x1);
        revert("LibWell: Well type not supported");
    }

    function getY(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint112 xi,
        uint256 k
    ) private pure returns (uint112) {
        uint256 y;
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            y = LibConstantProductWell2.getY(xi, k);
        else revert("LibWell: Well type not supported");
        require(y < type(uint112).max, "LibWell: y too high");
        return uint112(y);
    }

    function update(
        LibWellStorage.Well2State storage ws
    ) private {
        uint32 timestamp = uint32(block.timestamp);
        uint32 passedTime = timestamp - ws.lastTimestamp; // ws.lastTimestamp <= block.timestamp
        if (passedTime > 0) {
            // Overflow on addition is okay
            // overflow on multication is not possible b/c ws.balanceX <= (uint112).max and passedTime <= (uint32).max
            ws.cumulativeBalance0 = ws.cumulativeBalance0 + uint256(ws.balance0) * passedTime;
            ws.cumulativeBalance1 = ws.cumulativeBalance1 + uint256(ws.balance1) * passedTime;
            ws.lastTimestamp = uint32(block.timestamp);
        }
    }
}
