// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/Minting/LibCurveMinting.sol";
import "contracts/beanstalk/ReentrancyGuard.sol";
import "contracts/libraries/Minting/LibWellMinting.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

/**
 * @title Oracle
 * @author Publius, Chaikitty
 * @notice Tracks the Delta B in available pools.
 */
contract Oracle is ReentrancyGuard {
    
    using SignedSafeMath for int256;

    //////////////////// ORACLE GETTERS ////////////////////

    /**
     * @notice Returns the total Delta B across all whitelisted minting liquidity pools.
     * @dev The whitelisted pools are:
     * - the Bean:3Crv Metapool
     * - the Bean:ETH Well
     */
    function totalDeltaB() external view returns (int256 deltaB) {
        deltaB = LibCurveMinting.check().add(
            LibWellMinting.check(C.BEAN_ETH_WELL)
        );
    }

    /**
     * @notice Returns the current Delta B for the requested pool.
     */
    function poolDeltaB(address pool) external view returns (int256) {
        if (pool == C.CURVE_BEAN_METAPOOL) return LibCurveMinting.check();
        if (LibWell.isWell(pool)) return LibWellMinting.check(pool);
        revert("Oracle: Pool not supported");
    }

    //////////////////// ORACLE INTERNAL ////////////////////

    function stepOracle() internal returns (int256 deltaB) {
        deltaB = LibCurveMinting.capture();
        deltaB = deltaB.add(LibWellMinting.capture(C.BEAN_ETH_WELL));
        s.season.timestamp = block.timestamp;
    }

    /**
     * @notice Returns thelast Well Oracle Snapshot for a given `well`.
     * @return snapshot The encoded cumulative balances the last time the Oracle was captured.
     */
    function wellOracleSnapshot(address well) external view returns (bytes memory snapshot) {
        snapshot = s.wellOracleSnapshots[well];
    }

    /**
     * @notice Returns the last Curve Oracle data snapahost for the Bean:3Crv Pool.
     * @return co The last Curve Oracle data snapshot.
     */
    function curveOracle() external view returns (Storage.CurveMetapoolOracle memory co) {
        co = s.co;
        co.timestamp = s.season.timestamp; // use season timestamp for oracle
    }
}
