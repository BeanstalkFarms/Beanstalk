/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Oracle/LibCurveOracle.sol";
import "../../ReentrancyGuard.sol";

/**
 * @author Publius, Chaikitty
 * @title Oracle tracks the Delta B across the Uniswap and Curve Liquidity pools
 **/
contract Oracle is ReentrancyGuard {
    /**
     * Oracle Getters
     **/

    event MetapoolOracle(uint32 indexed season, int256 deltaB, uint256[2] balances);

    function totalDeltaB() external view returns (int256 deltaB) {
        deltaB = LibCurveOracle.check();
    }

    function poolDeltaB(address pool) external view returns (int256 deltaB) {
        if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }

    /**
     * Oracle Internal
     **/

    function stepOracle() internal returns (int256 deltaB, uint256[2] memory balances) {
        (deltaB, balances) = LibCurveOracle.capture();
    }
}
