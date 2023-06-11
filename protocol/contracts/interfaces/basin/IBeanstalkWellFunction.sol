// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {IWellFunction} from "./IWellFunction.sol";

/**
 * @title IBeanstalkWellFunction
 * @notice Defines all necessary functions for Beanstalk to support a Well Function in addition to functions defined in the primary interface.
 * This includes 2 functions to solve for a given reserve value suc that the average price between
 * the given reserve and all other reserves equals the average of the input ratios.
 * `calcReserveAtRatioSwap` assumes the target ratios are reached through executing a swap.
 * `calcReserveAtRatioLiquidity` assumes the target ratios are reached through adding/removing liquidity.
 */
interface IBeanstalkWellFunction is IWellFunction {
    /**
     * @notice Calculates the `j` reserve such that `π_{i | i != j} (d reserves_j / d reserves_i) = π_{i | i != j}(ratios_j / ratios_i)`.
     * assumes that reserve_j is being swapped for other reserves in the Well.
     * @dev used by Beanstalk to calculate the deltaB every Season
     * @param reserves The reserves of the Well
     * @param j The index of the reserve to solve for
     * @param ratios The ratios of reserves to solve for
     * @param data Well function data provided on every call
     * @return reserve The resulting reserve at the jth index
     */
    function calcReserveAtRatioSwap(
        uint[] calldata reserves,
        uint j,
        uint[] calldata ratios,
        bytes calldata data
    ) external view returns (uint reserve);

    /**
     * @notice Calculates the `j` reserve such that `π_{i | i != j} (d reserves_j / d reserves_i) = π_{i | i != j}(ratios_j / ratios_i)`.
     * assumes that reserve_j is being added or removed in exchange for LP Tokens.
     * @dev used by Beanstalk to calculate the max deltaB that can be converted in/out of a Well.
     * @param reserves The reserves of the Well
     * @param j The index of the reserve to solve for
     * @param ratios The ratios of reserves to solve for
     * @param data Well function data provided on every call
     * @return reserve The resulting reserve at the jth index
     */
    function calcReserveAtRatioLiquidity(
        uint[] calldata reserves,
        uint j,
        uint[] calldata ratios,
        bytes calldata data
    ) external pure returns (uint reserve);
}
