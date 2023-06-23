// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../Curve/LibBeanMetaCurve.sol";
import "../LibAppStorage.sol";
import "../LibSafeMath32.sol";
import "./LibMinting.sol";

/**
 * @dev Curve metapool functions used by {LibCurveMinting}. 
 */
interface IMeta3CurveOracle {
    function block_timestamp_last() external view returns (uint256);
    function get_price_cumulative_last() external view returns (uint256[2] memory);
    function get_balances() external view returns (uint256[2] memory);
    function get_previous_balances() external view returns (uint256[2] memory);
}

/**
 * @title Bean:3Crv Curve Metapool Minting Oracle Library
 * @author Publius, Chaikitty
 * @notice Bean:3Crv Curve Metapool Minting Oracle can be Checked or Captured to compute
 * the time weighted average Delta B since the last time the Oracle was Captured
 * for a given Well.
 *
 * @dev
 * The Oracle uses the Season timestamp stored in `s.season.timestamp` to determine how many seconds
 * it has been since the last Season instead of storing its own for efficiency purposes.
 * Each Capture stores the encoded cumulative balances returned by the Pump in `s.co`.
 */
library LibCurveMinting {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted when the Curve Minting Oracle is captured.
     * @param season The Season in which the oracle was updated.
     * @param deltaB The deltaB
     * @param balances The TWA 
     */
    event MetapoolOracle(
        uint32 indexed season,
        int256 deltaB,
        uint256[2] balances
    );

    //////////////////// CHECK ////////////////////

    /**
     * @dev Returns the time weighted average delta B in the Bean:3Crv Metapool
     * since the last Sunrise.
     * @return deltaB The time weighted average delta B balance since the last `capture` call.
     */
    function check() internal view returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            (deltaB, ) = twaDeltaB();
        } else {
            deltaB = 0;
        }

        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    //////////////////// CAPTURE ////////////////////

    /** 
     * @dev Returns the time weighted average delta B in a given Well
     * since the last Sunrise and snapshots the current cumulative reserves.
     * @return deltaB The time weighted average delta B balance since the last `capture` call.
     */
    function capture() internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            deltaB = updateOracle();
        } else {
            initializeOracle();
        }
        deltaB = LibMinting.checkForMaxDeltaB(deltaB);
    }

    //////////////////// Oracle ////////////////////

    /**
     * Initializes the Bean:3Crv Minting Oracle by snapshotting the current cumulative balances
     * in the Bean:3Crv pool.
     */
    function initializeOracle() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.CurveMetapoolOracle storage o = s.co;

        uint256[2] memory balances = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL)
            .get_price_cumulative_last();
        uint256 timestamp = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).block_timestamp_last();
        
        if (balances[0] != 0 && balances[1] != 0 && timestamp != 0) {
            o.balances = getCumulative();
            o.initialized = true;
        }
    }

    /**
     * @dev updates the Bean:3Crv Minting Oracle snapshot for a given Well and returns the deltaB
     * given the previous snapshot in the Well
     */
    function updateOracle() internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (deltaB, s.co.balances) = twaDeltaB();

        emit MetapoolOracle(s.season.current, deltaB, s.co.balances);
    }

    //////////////////// CALCULATIONS ////////////////////

    /**
     * @dev Calculates the time weighted average delta B since the
     * last `capture` call to the Bean:3Crv Curve Metapool.
     */
    function twaDeltaB()
        internal
        view
        returns (int256 deltaB, uint256[2] memory cumulativeBalances)
    {
        uint256[2] memory balances;
        (balances, cumulativeBalances) = twaBalances();
        uint256 d = LibBeanMetaCurve.getDFroms(balances);
        deltaB = LibBeanMetaCurve.getDeltaBWithD(balances[0], d);
    }

    /**
     * @dev Calculates the time weighted average balances since the
     * last `capture` call to the Bean:3Crv Curve Metapool.
     */
    function twaBalances()
        internal
        view
        returns (uint256[2] memory _twaBalances, uint256[2] memory cumulativeBalances)
    {
        cumulativeBalances = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).get_price_cumulative_last();
        _twaBalances = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).get_balances();
        uint256 lastTimestamp = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).block_timestamp_last();

        cumulativeBalances[0] = cumulativeBalances[0].add(
            _twaBalances[0].mul(block.timestamp.sub(lastTimestamp))
        );
        cumulativeBalances[1] = cumulativeBalances[1].add(
            _twaBalances[1].mul(block.timestamp.sub(lastTimestamp))
        );

        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.CurveMetapoolOracle storage o = s.co;

        uint256 deltaTimestamp = block.timestamp.sub(s.season.timestamp);

        _twaBalances[0] = cumulativeBalances[0].sub(o.balances[0]).div(deltaTimestamp);
        _twaBalances[1] = cumulativeBalances[1].sub(o.balances[1]).div(deltaTimestamp);
    }

    /**
     * @dev calcualte the current cumulative balances in the Bean:3Crv Curve Metapool.
     */
    function getCumulative()
        private
        view
        returns (uint256[2] memory cumulativeBalances)
    {
        cumulativeBalances = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).get_price_cumulative_last();
        uint256[2] memory balances = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).get_balances();
        uint256 lastTimestamp = IMeta3CurveOracle(C.CURVE_BEAN_METAPOOL).block_timestamp_last();

        cumulativeBalances[0] = cumulativeBalances[0].add(
            balances[0].mul(block.timestamp.sub(lastTimestamp))
        );
        cumulativeBalances[1] = cumulativeBalances[1].add(
            balances[1].mul(block.timestamp.sub(lastTimestamp))
        );
    }
}
