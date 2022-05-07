/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Oracle/LibCurveOracle.sol";
import "../../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Oracle tracks the Delta B across the Uniswap and Curve Liquidity pools
 **/
contract Oracle is ReentrancyGuard {
    /**
     * Oracle Getters
     **/

    function totalDeltaB() external view returns (int256 bdv) {
        bdv = LibCurveOracle.check();
    }

    function poolDeltaB(address pool) external view returns (int256 bdv) {
        if (pool == C.curveMetapoolAddress()) return LibCurveOracle.check();
        require(false, "Oracle: Pool not supported");
    }

    /**
     * Oracle Internal
     **/

    function stepOracle() internal returns (int256 bdv) {
        bdv = LibCurveOracle.capture();
    }
}
