// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title IWellFunction
 * @notice Defines a relationship between token reserves and LP token supply.
 * @dev Well Functions can contain arbitrary logic, but should be deterministic
 * if expected to be used alongside a Pump. When interacing with a Well or
 * Well Function, always verify that the Well Function is valid.
 */
interface IWellFunction {
    /**
     * @notice Calculates the `j`th reserve given a list of `reserves` and `lpTokenSupply`.
     * @param reserves A list of token reserves. The jth reserve will be ignored, but a placeholder must be provided.
     * @param j The index of the reserve to solve for
     * @param lpTokenSupply The supply of LP tokens
     * @param data Extra Well function data provided on every call
     * @return reserve The resulting reserve at the jth index
     * @dev Should round up to ensure that Well reserves are marginally higher to enforce calcLpTokenSupply(...) >= totalSupply()
     */
    function calcReserve(
        uint[] memory reserves,
        uint j,
        uint lpTokenSupply,
        bytes calldata data
    ) external view returns (uint reserve);

    /**
     * @notice Gets the LP token supply given a list of reserves.
     * @param reserves A list of token reserves
     * @param data Extra Well function data provided on every call
     * @return lpTokenSupply The resulting supply of LP tokens
     * @dev Should round down to ensure so that the Well Token supply is marignally lower to enforce calcLpTokenSupply(...) >= totalSupply()
     */
    function calcLpTokenSupply(
        uint[] memory reserves,
        bytes calldata data
    ) external view returns (uint lpTokenSupply);

    /**
     * @notice Calculates the amount of each reserve token underlying a given amount of LP tokens.
     * @param lpTokenAmount An amount of LP tokens
     * @param reserves A list of token reserves
     * @param lpTokenSupply The current supply of LP tokens
     * @param data Extra Well function data provided on every call
     * @return underlyingAmounts The amount of each reserve token that underlies the LP tokens
     * @dev The constraint totalSupply() <= calcLPTokenSupply(...) must be held in the case where
     * `lpTokenAmount` LP tokens are burned in exchanged for `underlyingAmounts`. If the constraint
     * does not hold, then the Well Function is invalid.
     */
    function calcLPTokenUnderlying(
        uint lpTokenAmount,
        uint[] memory reserves,
        uint lpTokenSupply,
        bytes calldata data
    ) external view returns (uint[] memory underlyingAmounts);

    /**
     * @notice Returns the name of the Well function.
     */
    function name() external view returns (string memory);

    /**
     * @notice Returns the symbol of the Well function.
     */
    function symbol() external view returns (string memory);
}
