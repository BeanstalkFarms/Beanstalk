/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title LiquidityWeightFacet
 * @author Brean
 * @notice determines the liquidity weight. Used in the gauge system.
 */
contract LiquidityWeightFacet {
    uint256 constant MAX_WEIGHT = 1e18;

    function maxWeight() external pure returns (uint256) {
        return MAX_WEIGHT;
    }
}
