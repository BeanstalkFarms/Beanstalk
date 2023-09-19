// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Call is the struct that contains the target address and extra calldata of a generic call.
 */
struct Call {
    address target; // The address the call is executed on.
    bytes data; // Extra calldata to be passed during the call
}

/**
 * @title IWell is the interface for the Well contract.
 *
 * In order for a Well to be verified using a permissionless on-chain registry, a Well Implementation should:
 * - Not be able to self-destruct (Aquifer's registry would be vulnerable to a metamorphic contract attack)
 * - Not be able to change its tokens, Well Function, Pumps and Well Data
 */
interface IWell {
    /**
     * @notice Emitted when a Swap occurs.
     * @param fromToken The token swapped from
     * @param toToken The token swapped to
     * @param amountIn The amount of `fromToken` transferred into the Well
     * @param amountOut The amount of `toToken` transferred out of the Well
     * @param recipient The address that received `toToken`
     */
    event Swap(IERC20 fromToken, IERC20 toToken, uint256 amountIn, uint256 amountOut, address recipient);

    /**
     * @notice Emitted when liquidity is added to the Well.
     * @param tokenAmountsIn The amount of each token added to the Well
     * @param lpAmountOut The amount of LP tokens minted
     * @param recipient The address that received the LP tokens
     */
    event AddLiquidity(uint256[] tokenAmountsIn, uint256 lpAmountOut, address recipient);

    /**
     * @notice Emitted when liquidity is removed from the Well as multiple underlying tokens.
     * @param lpAmountIn The amount of LP tokens burned
     * @param tokenAmountsOut The amount of each underlying token removed
     * @param recipient The address that received the underlying tokens
     * @dev Gas cost scales with `n` tokens.
     */
    event RemoveLiquidity(uint256 lpAmountIn, uint256[] tokenAmountsOut, address recipient);

    /**
     * @notice Emitted when liquidity is removed from the Well as a single underlying token.
     * @param lpAmountIn The amount of LP tokens burned
     * @param tokenOut The underlying token removed
     * @param tokenAmountOut The amount of `tokenOut` removed
     * @param recipient The address that received the underlying tokens
     * @dev Emitting a separate event when removing liquidity as a single token
     * saves gas, since `tokenAmountsOut` in {RemoveLiquidity} must emit a value
     * for each token in the Well.
     */
    event RemoveLiquidityOneToken(uint256 lpAmountIn, IERC20 tokenOut, uint256 tokenAmountOut, address recipient);

    /**
     * @notice Emitted when a Shift occurs.
     * @param reserves The ending reserves after a shift
     * @param toToken The token swapped to
     * @param amountOut The amount of `toToken` transferred out of the Well
     * @param recipient The address that received `toToken`
     */
    event Shift(uint256[] reserves, IERC20 toToken, uint256 amountOut, address recipient);

    /**
     * @notice Emitted when a Sync occurs.
     * @param reserves The ending reserves after a sync
     * @param lpAmountOut The amount of LP tokens received from the sync.
     * @param recipient The address that received the LP tokens
     */
    event Sync(uint256[] reserves, uint256 lpAmountOut, address recipient);

    //////////////////// WELL DEFINITION ////////////////////

    /**
     * @notice Returns a list of ERC20 tokens supported by the Well.
     */
    function tokens() external view returns (IERC20[] memory);

    /**
     * @notice Returns the Well function as a Call struct.
     * @dev Contains the address of the Well function contract and extra data to
     * pass during calls.
     *
     * **Well functions** define a relationship between the reserves of the
     * tokens in the Well and the number of LP tokens.
     *
     * A Well function MUST implement {IWellFunction}.
     */
    function wellFunction() external view returns (Call memory);

    /**
     * @notice Returns the Pumps attached to the Well as Call structs.
     * @dev Contains the addresses of the Pumps contract and extra data to pass
     * during calls.
     *
     * **Pumps** are on-chain oracles that are updated every time the Well is
     * interacted with.
     *
     * A Pump is not required for Well operation. For Wells without a Pump:
     * `pumps().length = 0`.
     *
     * An attached Pump MUST implement {IPump}.
     */
    function pumps() external view returns (Call[] memory);

    /**
     * @notice Returns the Well data that the Well was bored with.
     * @dev The existence and signature of Well data is determined by each individual implementation.
     */
    function wellData() external view returns (bytes memory);

    /**
     * @notice Returns the Aquifer that created this Well.
     * @dev Wells can be permissionlessly bored in an Aquifer.
     *
     * Aquifers stores the implementation that was used to bore the Well.
     */
    function aquifer() external view returns (address);

    /**
     * @notice Returns the tokens, Well Function, Pumps and Well Data associated
     * with the Well as well as the Aquifer that deployed the Well.
     */
    function well()
        external
        view
        returns (
            IERC20[] memory _tokens,
            Call memory _wellFunction,
            Call[] memory _pumps,
            bytes memory _wellData,
            address _aquifer
        );

    //////////////////// SWAP: FROM ////////////////////

    /**
     * @notice Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountIn The amount of `fromToken` to spend
     * @param minAmountOut The minimum amount of `toToken` to receive
     * @param recipient The address to receive `toToken`
     * @param deadline The timestamp after which this operation is invalid
     * @return amountOut The amount of `toToken` received
     */
    function swapFrom(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /**
     * @notice Swaps from an exact amount of `fromToken` to a minimum amount of `toToken` and supports fee on transfer tokens.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountIn The amount of `fromToken` to spend
     * @param minAmountOut The minimum amount of `toToken` to take from the Well. Note that if `toToken` charges a fee on transfer, `recipient` will receive less than this amount.
     * @param recipient The address to receive `toToken`
     * @param deadline The timestamp after which this operation is invalid
     * @return amountOut The amount of `toToken` transferred from the Well. Note that if `toToken` charges a fee on transfer, `recipient` may receive less than this amount.
     * @dev Can also be used for tokens without a fee on transfer, but is less gas efficient.
     */
    function swapFromFeeOnTransfer(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /**
     * @notice Gets the amount of one token received for swapping an amount of another token.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountIn The amount of `fromToken` to spend
     * @return amountOut The amount of `toToken` to receive
     */
    function getSwapOut(IERC20 fromToken, IERC20 toToken, uint256 amountIn) external view returns (uint256 amountOut);

    //////////////////// SWAP: TO ////////////////////

    /**
     * @notice Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param maxAmountIn The maximum amount of `fromToken` to spend
     * @param amountOut The amount of `toToken` to receive
     * @param recipient The address to receive `toToken`
     * @param deadline The timestamp after which this operation is invalid
     * @return amountIn The amount of `toToken` received
     */
    function swapTo(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 maxAmountIn,
        uint256 amountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountIn);

    /**
     * @notice Gets the amount of one token that must be spent to receive an amount of another token during a swap.
     * @param fromToken The token to swap from
     * @param toToken The token to swap to
     * @param amountOut The amount of `toToken` desired
     * @return amountIn The amount of `fromToken` that must be spent
     */
    function getSwapIn(IERC20 fromToken, IERC20 toToken, uint256 amountOut) external view returns (uint256 amountIn);

    //////////////////// SHIFT ////////////////////

    /**
     * @notice Shifts at least `minAmountOut` excess tokens held by the Well into `tokenOut` and delivers to `recipient`.
     * @param tokenOut The token to shift into
     * @param minAmountOut The minimum amount of `tokenOut` to receive
     * @param recipient The address to receive the token
     * @return amountOut The amount of `tokenOut` received
     * @dev Can be used in a multicall using a contract like Pipeline to perform gas efficient swaps.
     * No deadline is needed since this function does not use the user's assets. If adding liquidity in a multicall,
     * then a deadline check can be added to the multicall.
     */
    function shift(IERC20 tokenOut, uint256 minAmountOut, address recipient) external returns (uint256 amountOut);

    /**
     * @notice Calculates the amount of the token out received from shifting excess tokens held by the Well.
     * @param tokenOut The token to shift into
     * @return amountOut The amount of `tokenOut` received
     */
    function getShiftOut(IERC20 tokenOut) external returns (uint256 amountOut);

    //////////////////// ADD LIQUIDITY ////////////////////

    /**
     * @notice Adds liquidity to the Well as multiple tokens in any ratio.
     * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
     * @param minLpAmountOut The minimum amount of LP tokens to receive
     * @param recipient The address to receive the LP tokens
     * @param deadline The timestamp after which this operation is invalid
     * @return lpAmountOut The amount of LP tokens received
     */
    function addLiquidity(
        uint256[] memory tokenAmountsIn,
        uint256 minLpAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 lpAmountOut);

    /**
     * @notice Adds liquidity to the Well as multiple tokens in any ratio and supports
     * fee on transfer tokens.
     * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
     * @param minLpAmountOut The minimum amount of LP tokens to receive
     * @param recipient The address to receive the LP tokens
     * @param deadline The timestamp after which this operation is invalid
     * @return lpAmountOut The amount of LP tokens received
     * @dev Can also be used for tokens without a fee on transfer, but is less gas efficient.
     */
    function addLiquidityFeeOnTransfer(
        uint256[] memory tokenAmountsIn,
        uint256 minLpAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 lpAmountOut);

    /**
     * @notice Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
     * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
     * @return lpAmountOut The amount of LP tokens received
     */
    function getAddLiquidityOut(uint256[] memory tokenAmountsIn) external view returns (uint256 lpAmountOut);

    //////////////////// REMOVE LIQUIDITY: BALANCED ////////////////////

    /**
     * @notice Removes liquidity from the Well as all underlying tokens in a balanced ratio.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @param recipient The address to receive the underlying tokens
     * @param deadline The timestamp after which this operation is invalid
     * @return tokenAmountsOut The amount of each underlying token received
     */
    function removeLiquidity(
        uint256 lpAmountIn,
        uint256[] calldata minTokenAmountsOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory tokenAmountsOut);

    /**
     * @notice Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
     * @param lpAmountIn The amount of LP tokens to burn
     * @return tokenAmountsOut The amount of each underlying token received
     */
    function getRemoveLiquidityOut(uint256 lpAmountIn) external view returns (uint256[] memory tokenAmountsOut);

    //////////////////// REMOVE LIQUIDITY: ONE TOKEN ////////////////////

    /**
     * @notice Removes liquidity from the Well as a single underlying token.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param tokenOut The underlying token to receive
     * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
     * @param recipient The address to receive the underlying tokens
     * @param deadline The timestamp after which this operation is invalid
     * @return tokenAmountOut The amount of `tokenOut` received
     */
    function removeLiquidityOneToken(
        uint256 lpAmountIn,
        IERC20 tokenOut,
        uint256 minTokenAmountOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 tokenAmountOut);

    /**
     * @notice Gets the amount received from removing liquidity from the Well as a single underlying token.
     * @param lpAmountIn The amount of LP tokens to burn
     * @param tokenOut The underlying token to receive
     * @return tokenAmountOut The amount of `tokenOut` received
     *
     */
    function getRemoveLiquidityOneTokenOut(
        uint256 lpAmountIn,
        IERC20 tokenOut
    ) external view returns (uint256 tokenAmountOut);

    //////////////////// REMOVE LIQUIDITY: IMBALANCED ////////////////////

    /**
     * @notice Removes liquidity from the Well as multiple underlying tokens in any ratio.
     * @param maxLpAmountIn The maximum amount of LP tokens to burn
     * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @param recipient The address to receive the underlying tokens
     * @return lpAmountIn The amount of LP tokens burned
     */
    function removeLiquidityImbalanced(
        uint256 maxLpAmountIn,
        uint256[] calldata tokenAmountsOut,
        address recipient,
        uint256 deadline
    ) external returns (uint256 lpAmountIn);

    /**
     * @notice Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
     * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
     * @return lpAmountIn The amount of LP tokens burned
     */
    function getRemoveLiquidityImbalancedIn(uint256[] calldata tokenAmountsOut)
        external
        view
        returns (uint256 lpAmountIn);

    //////////////////// RESERVES ////////////////////

    /**
     * @notice Syncs the Well's reserves with the Well's balances of underlying tokens. If the reserves
     * increase, mints at least `minLpAmountOut` LP Tokens to `recipient`.
     * @param recipient The address to receive the LP tokens
     * @param minLpAmountOut The minimum amount of LP tokens to receive
     * @return lpAmountOut The amount of LP tokens received
     * @dev Can be used in a multicall using a contract like Pipeline to perform gas efficient additions of liquidity.
     * No deadline is needed since this function does not use the user's assets. If adding liquidity in a multicall,
     * then a deadline check can be added to the multicall.
     * If `sync` decreases the Well's reserves, then no LP tokens are minted and `lpAmountOut` must be 0.
     */
    function sync(address recipient, uint256 minLpAmountOut) external returns (uint256 lpAmountOut);

    /**
     * @notice Calculates the amount of LP Tokens received from syncing the Well's reserves with the Well's balances.
     * @return lpAmountOut The amount of LP tokens received
     */
    function getSyncOut() external view returns (uint256 lpAmountOut);

    /**
     * @notice Sends excess tokens held by the Well to the `recipient`.
     * @param recipient The address to send the tokens
     * @return skimAmounts The amount of each token skimmed
     * @dev No deadline is needed since this function does not use the user's assets.
     */
    function skim(address recipient) external returns (uint256[] memory skimAmounts);

    /**
     * @notice Gets the reserves of each token held by the Well.
     */
    function getReserves() external view returns (uint256[] memory reserves);

    /**
     * @notice Returns whether or not the Well is initialized if it requires initialization.
     * If a Well does not require initialization, it should always return `true`.
     */
    function isInitialized() external view returns (bool);
}