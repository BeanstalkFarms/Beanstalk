/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Brean
 * @title Mock liquidityWeight contract.
 * @notice Contains a valid and invalid liquidityWeight implmentation.
 **/
contract MockLiquidityWeight {

    uint256 public liquidityWeight;

    constructor(uint256 _liquidityWeight) {
        liquidityWeight = _liquidityWeight;
    }

    /**
     * @notice Valid implmentation.
     */
    function getLiquidityWeight() public view returns (uint256) {
        return liquidityWeight;
    }

    /**
     * @notice Invalid due to input parameter.
     */
    function getInvalidLiquidityWeight(uint256 param1) external view returns (uint256) {
        return liquidityWeight * param1;
    }

    /**
     * @notice Invalid due to changing state.
     */
    function getInvalidLiquidityWeight2() external returns (uint256) {
        liquidityWeight = liquidityWeight;
        return liquidityWeight;
    }
}