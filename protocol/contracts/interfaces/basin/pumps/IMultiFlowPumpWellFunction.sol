// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IWellFunction} from "../IWellFunction.sol";

/**
 * @title IMultiFlowPumpWellFunction
 * @dev A Well Function must implement IMultiFlowPumpWellFunction to be supported by
 * the Multi Flow Pump.
 */
interface IMultiFlowPumpWellFunction is IWellFunction {
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
        uint256[] calldata reserves,
        uint256 j,
        uint256[] calldata ratios,
        bytes calldata data
    ) external view returns (uint256 reserve);

    /**
     * @notice Calculates the rate at which j can be exchanged for i.
     * @param reserves The reserves of the Well
     * @param i The index of the token for which the output is being calculated
     * @param j The index of the token for which 1 token is being exchanged
     * @param data Well function data provided on every call
     * @return rate The rate at which j can be exchanged for i
     * @dev should return with 36 decimal precision
     */
    function calcRate(
        uint256[] calldata reserves,
        uint256 i,
        uint256 j,
        bytes calldata data
    ) external view returns (uint256 rate);
}
