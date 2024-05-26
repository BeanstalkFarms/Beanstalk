/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {AppStorage, LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibConvert} from "contracts/libraries/Convert/LibConvert.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibDeltaB} from "contracts/libraries/Oracle/LibDeltaB.sol";

/**
 * @author Publius
 * @title ConvertGettersFacet contains view functions related to converting Deposited assets.
 **/
contract ConvertGettersFacet {
    using LibRedundantMath256 for uint256;

    /**
     * @notice Returns the maximum amount that can be converted of `tokenIn` to `tokenOut`.
     */
    function getMaxAmountIn(
        address tokenIn,
        address tokenOut
    ) external view returns (uint256 amountIn) {
        return LibConvert.getMaxAmountIn(tokenIn, tokenOut);
    }

    /**
     * @notice Returns the amount of `tokenOut` recieved from converting `amountIn` of `tokenIn`.
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        return LibConvert.getAmountOut(tokenIn, tokenOut, amountIn);
    }

    function overallCappedDeltaB() external view returns (int256 deltaB) {
        return LibDeltaB.overallCappedDeltaB();
    }

    /**
     * @notice returns the overall current deltaB for all whitelisted well tokens.
     */
    function overallCurrentDeltaB() external view returns (int256 deltaB) {
        return LibDeltaB.overallCurrentDeltaB();
    }

    /*
     * @notice returns the scaled deltaB, based on LP supply before and after convert
     */
    function scaledDeltaB(
        uint256 beforeLpTokenSupply,
        uint256 afterLpTokenSupply,
        int256 deltaB
    ) external pure returns (int256) {
        return LibDeltaB.scaledDeltaB(beforeLpTokenSupply, afterLpTokenSupply, deltaB);
    }

    /**
     * @notice Returns the multi-block MEV resistant deltaB for a given token using capped reserves from the well.
     * @param well The well for which to return the capped reserves deltaB
     * @return deltaB The capped reserves deltaB for the well
     */
    function cappedReservesDeltaB(address well) external view returns (int256 deltaB) {
        return LibDeltaB.cappedReservesDeltaB(well);
    }

    /**
     * @notice Returns currently available convert power for this block
     * @return convertCapacity The amount of convert power available for this block
     */
    function getOverallConvertCapacity() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 _overallCappedDeltaB = LibConvert.abs(LibDeltaB.overallCappedDeltaB());
        uint256 overallConvertCapacityUsed = s.sys
            .convertCapacity[block.number]
            .overallConvertCapacityUsed;
        return
            overallConvertCapacityUsed > _overallCappedDeltaB
                ? 0
                : _overallCappedDeltaB.sub(overallConvertCapacityUsed);
    }

    /**
     * @notice returns the Convert Capacity for a given well
     * @dev the convert capacity is the amount of deltaB that can be converted in a block.
     * This is a function of the capped reserves deltaB.
     */
    function getWellConvertCapacity(address well) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return
            LibConvert.abs(LibDeltaB.cappedReservesDeltaB(well)).sub(
                s.sys.convertCapacity[block.number].wellConvertCapacityUsed[well]
            );
    }

    /**
     * @notice Calculates the bdv penalized by a convert.
     * @dev See {LibConvert.calculateStalkPenalty}.
     */
    function calculateStalkPenalty(
        LibConvert.DeltaBStorage memory dbs,
        uint256 bdvConverted,
        uint256 overallConvertCapacity,
        address inputToken,
        address outputToken
    )
        external
        view
        returns (
            uint256 stalkPenaltyBdv,
            uint256 overallConvertCapacityUsed,
            uint256 inputTokenAmountUsed,
            uint256 outputTokenAmountUsed
        )
    {
        return
            LibConvert.calculateStalkPenalty(
                dbs,
                bdvConverted,
                overallConvertCapacity,
                inputToken,
                outputToken
            );
    }
}
