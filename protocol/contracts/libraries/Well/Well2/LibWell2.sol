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
import "../../../tokens/ERC20/WellERC20.sol";
import "../../Token/LibTransfer.sol";

/**
 * @author Publius
 * @title Lib Well2
 **/
library LibWell2 {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

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
        (uint128 balanceI, uint128 balanceJ) = w.tokens[0] == iToken ? (ws.balance0, ws.balance1) : (ws.balance1, ws.balance0);
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
        (uint128 balanceI, uint128 balanceJ) = w.tokens[0] == iToken ? (ws.balance0, ws.balance1) : (ws.balance1, ws.balance0);
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
            emit LibWellStorage.Swap(w.wellId, jToken, iToken, uint256(-dy), uint256(-dx));
        else
            emit LibWellStorage.Swap(w.wellId, iToken, jToken, uint256(dx), uint256(dy));
    }

    function _getSwap(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint128 balanceI,
        uint128 balanceJ,
        int256 dx
    ) private pure returns (uint128, uint128, int256) {
        uint256 d = getD(wellType, typeData, balanceI, balanceJ);
        balanceI = dx > 0
            ? balanceI.add(uint128(dx))
            : balanceI.sub(uint128(-dx));
        uint256 yBefore = balanceJ;
        balanceJ = getY(wellType, typeData, balanceI, d);
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
        uint256 d1 = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        ws.balance0 = ws.balance0.add(uint128(amounts[0]));
        ws.balance1 = ws.balance1.add(uint128(amounts[1]));
        uint256 d2 = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        amountOut = d2.sub(d1);
        require(amountOut >= minAmountOut, "LibWell: Not enough LP.");
        LibTransfer.mintToken(IBean(w.wellId), amountOut, recipient, toMode);
        emit LibWellStorage.AddLiquidity(w.wellId, amounts);
    }

    function getAddLiquidityOut(LibWellStorage.WellInfo calldata w, uint256[] memory amounts)
        internal
        view
        returns (uint256 amountOut)
    {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        uint256 d1 = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        uint128 balance0 = ws.balance0.add(uint128(amounts[0]));
        uint128 balance1 = ws.balance1.add(uint128(amounts[1]));
        uint256 d2 = getD(w.wellType, w.typeData, balance0, balance1);
        amountOut = d2.sub(d1);
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
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        uint256 d = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        tokenAmountsOut = new uint256[](2);

        tokenAmountsOut[0] = lpAmountIn.mul(ws.balance0).div(d); // Downcasting ok because lpAmountIn <= d
        ws.balance0 = ws.balance0.sub(uint128(tokenAmountsOut[0]));
        tokenAmountsOut[1] = lpAmountIn.mul(ws.balance1).div(d); // Downcasting ok because lpAmountIn <= d
        ws.balance1 = ws.balance1.sub(uint128(tokenAmountsOut[1]));

        require(
            tokenAmountsOut[0] >= minTokenAmountsOut[0] &&
            tokenAmountsOut[1] >= minTokenAmountsOut[1],
            "LibWell: Not enough out."
        );
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit LibWellStorage.RemoveLiquidity(w.wellId, tokenAmountsOut);
    }

    function getRemoveLiquidityOut(LibWellStorage.WellInfo calldata w, uint256 lpAmountIn)
        internal
        view
        returns (uint256[] memory tokenAmountsOut)
    {
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        uint256 d = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        tokenAmountsOut = new uint256[](2);
        tokenAmountsOut[0] = lpAmountIn.mul(ws.balance0).div(d); // Downcasting ok because lpAmountIn <= d
        tokenAmountsOut[1] = lpAmountIn.mul(ws.balance1).div(d); // Downcasting ok because lpAmountIn <= d
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
    ) internal returns (uint256 tokenAmountOut) {
        uint128 y;
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
        emit LibWellStorage.RemoveLiquidityOneToken(w.wellId, token, tokenAmountOut);
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
        uint128 balanceI,
        uint256 lpAmountIn
    ) private view returns (uint256 tokenAmountOut, uint128 y) {
        uint256 d = getD(w.wellType, w.typeData, ws.balance0, ws.balance1);
        d = d.sub(lpAmountIn, "LibWell: too much LP");
        y = getY(w.wellType, w.typeData, balanceI, d);
        tokenAmountOut = balanceI.sub(y);
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
        LibWellStorage.Well2State storage ws = LibWellStorage.well2State(w);
        update(ws);
        (lpAmountIn, ws.balance0, ws.balance1) = _getRemoveLiquidityImbalanced(w, ws.balance0, ws.balance1, tokenAmountsOut);
        require(lpAmountIn <= maxLPAmountIn, "LibWell: in too high.");
        LibTransfer.burnToken(IBean(w.wellId), lpAmountIn, recipient, fromMode);
        emit LibWellStorage.RemoveLiquidity(w.wellId, tokenAmountsOut);
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
        uint128 balance0,
        uint128 balance1,
        uint256[] calldata tokenAmountsOut
    ) private pure returns (uint256, uint128, uint128) {
        uint256 d1 = getD(w.wellType, w.typeData, balance0, balance1);
        balance0 = balance0.sub(uint128(tokenAmountsOut[0]));
        balance1 = balance1.sub(uint128(tokenAmountsOut[1]));
        uint256 d2 = getD(w.wellType, w.typeData, balance0, balance1);
        return (d1.sub(d2), balance0, balance1);
    }

    /**
     * State
    **/

    function getWellState(bytes32 wellHash) internal view returns (LibWellStorage.WellState memory s) {
        LibWellStorage.Well2State memory s2 = LibWellStorage.wellStorage().w2s[wellHash];
        s.balances = new uint128[](2);
        s.balances[0] = s2.balance0;
        s.balances[1] = s2.balance1;
        s.cumulativeBalances = new uint224[](2);
        s.cumulativeBalances[0] = s2.last.cumulativeBalance0;
        s.cumulativeBalances[1] = s2.last.cumulativeBalance1;
        s.lastTimestamp = s2.last.timestamp;
    }

    /**
     * Internal
     **/

    function getD(
        LibWellStorage.WellType wellType,
        bytes memory typeData,
        uint128 x0,
        uint128 x1
    ) internal pure returns (uint256) {
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            return LibConstantProductWell2.getD(x0, x1);
        revert("LibWell: Well type not supported");
    }

    function getY(
        LibWellStorage.WellType wellType,
        bytes calldata typeData,
        uint128 xi,
        uint256 d
    ) private pure returns (uint128) {
        uint256 y;
        if (wellType == LibWellStorage.WellType.CONSTANT_PRODUCT)
            y = LibConstantProductWell2.getY(xi, d);
        else revert("LibWell: Well type not supported");
        require(y < type(uint128).max, "LibWell: y too high");
        return uint128(y);
    }

    /**
     * Oracle
     **/

    function update(
        LibWellStorage.Well2State storage ws
    ) private {
        // uint32 hourstamp = uint32(block.timestamp)/3600;
        // uint32 lastHourstamp = hourstamp-1;
        // if (lastHourstamp > ws.last.timestamp/3600)
        //     record(lastHourstamp%2==0 ? ws.even : ws.odd, ws.balance0, ws.balance1, lastHourstamp*3600);
        // if (hourstamp > ws.last.timestamp/3600)
        //     record(hourstamp%2==0 ? ws.even : ws.odd, ws.balance0, ws.balance1, hourstamp*3600);
        // record(ws.last, ws.balance0, ws.balance1, uint32(block.timestamp));
    }

    function record(LibWellStorage.CumulativeBalance2 storage cb, uint128 balance0, uint256 balance1, uint32 timestamp) private {
        uint32 passedTime = timestamp - cb.timestamp; // ws.lastTimestamp <= block.timestamp
        if (passedTime > 0) {
            // Overflow on addition is okay
            // overflow on multication is not possible b/c ws.balanceX <= (uint128).max and passedTime <= (uint32).max
            cb.cumulativeBalance0 = cb.cumulativeBalance0 + uint224(balance0) * passedTime;
            cb.cumulativeBalance1 = cb.cumulativeBalance1 + uint224(balance1) * passedTime;
            cb.timestamp = timestamp;
        }
    }

    function getTWAL(bytes32 wellHash) internal view returns (uint256 balance0, uint256 balance1) {
        LibWellStorage.CumulativeBalance2 memory cb2 = getEndCumulativeBalance(wellHash);
        LibWellStorage.CumulativeBalance2 memory cb1 = getStartCumulativeBalance(wellHash);
        uint32 timePassed = cb2.timestamp - cb1.timestamp;
        balance0 = uint256(cb2.cumulativeBalance0 - cb1.cumulativeBalance0) / timePassed;
        balance1 = uint256(cb2.cumulativeBalance1 - cb1.cumulativeBalance1) / timePassed;
    }

    function getEndCumulativeBalance(bytes32 wellHash) internal view returns (LibWellStorage.CumulativeBalance2 memory cb) {
        LibWellStorage.Well2State storage s2 = LibWellStorage.wellStorage().w2s[wellHash];
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 passedTime = blockTimestamp - s2.last.timestamp;
        if (passedTime == 0) return s2.last;
        cb = updateCumulative(s2.last, s2.balance0, s2.balance1, passedTime);
    }

    function getStartCumulativeBalance(bytes32 wellHash) internal view returns (LibWellStorage.CumulativeBalance2 memory cb) {
        LibWellStorage.Well2State storage s2 = LibWellStorage.wellStorage().w2s[wellHash];
        (uint32 lastHourstamp, bool even) = LibMath.getLastHourstamp();
        if (lastHourstamp > s2.last.timestamp) {
            uint32 passedTime = lastHourstamp -  s2.last.timestamp;
            cb = updateCumulative(s2.last, s2.balance0, s2.balance1, passedTime);
        } else {
            if (even) cb = s2.even;
            else cb = s2.odd;
        }
    }

    function updateCumulative(LibWellStorage.CumulativeBalance2 storage cb, uint128 balance0, uint128 balance1, uint32 passedTime) internal view returns (LibWellStorage.CumulativeBalance2 memory cb2) {
        cb2.cumulativeBalance0 = cb.cumulativeBalance0 + uint224(balance0) * passedTime;
        cb2.cumulativeBalance1 = cb.cumulativeBalance1 + uint224(balance1) * passedTime;
        cb2.timestamp = passedTime;
    }
}
