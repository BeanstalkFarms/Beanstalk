// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Oracle/LibCurveOracle.sol";
import "~/beanstalk/ReentrancyGuard.sol";

/**
 * @title Oracle
 * @notice Tracks the Delta B in available pools.
 * @author Publius, Chaikitty
 */
contract Oracle is ReentrancyGuard {
    
    //////////////////// ORACLE GETTERS ////////////////////

    /**
     * @notice Returns the current Delta B in the Curve liquidity pool.
     */
    function totalDeltaB() external view returns (int256 deltaB) {
        deltaB = LibCurveOracle.check();
    }

    /**
     * @notice Returns the current Delta B for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256 deltaB) {
        if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }

    //////////////////// ORACLE INTERNAL ////////////////////

    function stepOracle() internal returns (int256 deltaB, uint256[2] memory balances) {
        (deltaB, balances) = LibCurveOracle.capture();
    }
}
