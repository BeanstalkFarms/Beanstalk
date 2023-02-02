/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Oracle/LibCurveOracle.sol";
import "~/beanstalk/ReentrancyGuard.sol";

/**
 * @title Oracle
 * @notice Tracks the Delta B across the Uniswap and Curve Liquidity pools
 * @author Publius, Chaikitty
 */
contract Oracle is ReentrancyGuard {
    event MetapoolOracle(uint32 indexed season, int256 deltaB, uint256[2] balances);

    function totalDeltaB() external view returns (int256 deltaB) {
        deltaB = LibCurveOracle.check();
    }

    function poolDeltaB(address pool) external view returns (int256 deltaB) {
        if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }

    function stepOracle() internal returns (int256 deltaB, uint256[2] memory balances) {
        (deltaB, balances) = LibCurveOracle.capture();
    }
}
