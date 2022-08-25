// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Well/LibWell.sol";
import "../../libraries/Well/LibWellBuilding.sol";
import "../../libraries/LibDiamond.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Well Facet
 **/
contract WellFacet is ReentrancyGuard {

    using LibTransfer for IERC20;

    /**
     * Swapping
    **/

    function swapFrom(
         LibWellStorage.WellInfo calldata w,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 amountOut) {
        amountIn = fromToken.receiveToken(amountIn, msg.sender, fromMode);
        amountOut = uint256(LibWell.swap(w, fromToken, toToken, int128(amountIn), int128(minAmountOut)));
        toToken.sendToken(amountOut, msg.sender, toMode);
    }

    function getSwapOut(
         LibWellStorage.WellInfo calldata w,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        amountOut = uint256(LibWell.getSwap(w, fromToken, toToken, int128(amountIn)));
    }

    function swapTo(
         LibWellStorage.WellInfo calldata w,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 maxAmountIn,
        uint256 amountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 amountIn) {
        require(fromMode != LibTransfer.From.INTERNAL_TOLERANT, "WellFacet: mode not allowed");
        amountIn = uint256(-LibWell.swap(w, toToken, fromToken, int128(-amountOut), int128(-maxAmountIn)));
        fromToken.receiveToken(amountIn, msg.sender, fromMode);
        toToken.sendToken(amountOut, msg.sender, toMode);
    }

    function getSwapIn(
        LibWellStorage.WellInfo calldata w,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountOut
    ) external view returns (uint256 amountIn) {
        amountIn = uint256(-LibWell.getSwap(w, toToken, fromToken, int128(-amountOut)));
    }

    /**
     * Add Liquidty
    **/

    function addLiquidity(
        LibWellStorage.WellInfo calldata w,
        uint256[] memory tokenAmounts,
        uint256 minLPAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 lpAmountOut) {
        for (uint i; i < tokenAmounts.length; ++i)
            tokenAmounts[i] = w.tokens[i].receiveToken(tokenAmounts[i], msg.sender, fromMode);
        lpAmountOut = LibWell.addLiquidity(w, tokenAmounts, minLPAmountOut, msg.sender, toMode);
    }

    function getAddLiquidityOut(
         LibWellStorage.WellInfo calldata w,
        uint256[] calldata tokenAmounts
    ) external view returns (uint256 lpAmountOut) {
        lpAmountOut = LibWell.getAddLiquidityOut(w, tokenAmounts);
    }

    /**
     * Remove Liquidty
    **/

    function removeLiquidity(
         LibWellStorage.WellInfo calldata w,
        uint256 lpAmountIn,
        uint256[] calldata minTokenAmountsOut,
        LibTransfer.From fromMode, 
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256[] memory tokenAmountsOut) {
        tokenAmountsOut = LibWell.removeLiquidity(w, lpAmountIn, minTokenAmountsOut, msg.sender, fromMode);
        for (uint i; i < tokenAmountsOut.length; ++i)
            w.tokens[i].sendToken(tokenAmountsOut[i], msg.sender, toMode);
    }

    function getRemoveLiquidityOut( LibWellStorage.WellInfo calldata w, uint256 lpAmountIn)
        external
        view
        returns (uint256[] memory tokenAmountsOut) {
            tokenAmountsOut = LibWell.getRemoveLiquidityOut(w, lpAmountIn);
        }

    function removeLiquidityOneToken(
         LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn,
        uint256 minTokenAmountOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 tokenAmountOut) {
        tokenAmountOut = LibWell.removeLiquidityOneToken(w, token, lpAmountIn, minTokenAmountOut, msg.sender, fromMode);
        token.sendToken(uint256(tokenAmountOut), msg.sender, toMode);
    }

    function getRemoveLiquidityOneTokenOut(
        LibWellStorage.WellInfo calldata w,
        IERC20 token,
        uint256 lpAmountIn
    ) external view returns (uint256 tokenAmountOut) {
        tokenAmountOut = LibWell.getRemoveLiquidityOneTokenOut(w, token, lpAmountIn);
    }

    function removeLiquidityImbalanced(
        LibWellStorage.WellInfo calldata w,
        uint256 maxLPAmountIn,
        uint256[] calldata tokenAmountsOut,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable nonReentrant returns (uint256 lpAmountIn) {
        lpAmountIn = LibWell.removeLiquidityImbalanced(w, maxLPAmountIn, tokenAmountsOut, msg.sender, fromMode);
        for (uint i; i < tokenAmountsOut.length; ++i)
            w.tokens[i].sendToken(tokenAmountsOut[i], msg.sender, toMode);
    }

    function getRemoveLiquidityImbalancedIn(
        LibWellStorage.WellInfo calldata w,
        uint256[] calldata amountsOut
    ) external view returns (uint256 lpAmountIn) {
        lpAmountIn = LibWell.getRemoveLiquidityImbalanced(w, amountsOut);
    }

    /**
     * Info
    **/

    function getTokens(address wellId) external view returns (IERC20[] memory tokens) {
        tokens = getWellInfo(wellId).tokens;
    }

    function getWellInfo(address wellId) public view returns (LibWellStorage.WellInfo memory info) {
         LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        info = s.wi[wellId];
    }

    function getWellIdAtIndex(uint256 index) public view returns (address wellId) {
         LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        wellId = s.indices[index];
    }

    function getWellHash(address wellId) public view returns (bytes32 wellHash) {
         LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        wellHash = s.wh[wellId];
    }

    function computeWellHash( LibWellStorage.WellInfo calldata p) external pure returns (bytes32 wellHash) {
        wellHash = LibWellStorage.computeWellHash(p);
    }

    /**
     * State
     **/

    function getD(address wellId) public view returns (uint256 d) {
        LibWellStorage.WellInfo memory info = getWellInfo(wellId);
        d = LibWell.getD(
            info.wellType,
            info.typeData,
            getWellBalances(wellId)
        );
    }

    function getWellBalances(address wellId) public view returns (uint128[] memory balances) {
        balances = getWellState(wellId).balances;
    }
    function getLastCumulativeBalances(address wellId) external view returns (uint224[] memory cumulativeBalances) {
        cumulativeBalances = getWellState(wellId).cumulativeBalances;
    }
    function getLastTimestamp(address wellId) external view returns (uint32 lastTimestamp) {
        lastTimestamp = getWellState(wellId).lastTimestamp;
    }

    function getWellState(address wellId) public view returns (LibWellStorage.WellState memory state) {
        state = getWellStateFromHash(getWellHash(wellId));
    }

    function getWellStateFromHash(bytes32 wellHash) public view returns (LibWellStorage.WellState memory state) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        if (s.w2s[wellHash].last.timestamp > 0) state = LibWell2.getWellState(wellHash);
        else state = LibWellN.getWellState(wellHash);
    }


    function getWell2StateFromHash(bytes32 wellHash) public view returns (LibWellStorage.Well2State memory state) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        state = s.w2s[wellHash];
    }

    function getWellNStateFromHash(bytes32 wellHash) public view returns (LibWellStorage.WellNState memory state) {
        LibWellStorage.WellStorage storage s = LibWellStorage.wellStorage();
        state = s.wNs[wellHash];
    }

    /**
     * Info + State
    **/

    function getWellAtIndex(uint256 index) external view returns ( LibWellStorage.WellInfo memory info,  LibWellStorage.WellState memory state, uint256 d) {
        return getWell(getWellIdAtIndex(index));
    }

    function getWell(address wellId) public view returns (LibWellStorage.WellInfo memory info,  LibWellStorage.WellState memory state, uint256 d) {
        info = getWellInfo(wellId);
        state = getWellState(wellId);
        d = LibWell.getD(
            info.wellType,
            info.typeData,
            state.balances
        );
    }
}