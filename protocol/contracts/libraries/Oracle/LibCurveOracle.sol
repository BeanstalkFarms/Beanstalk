/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../Curve/LibBeanMetaCurve.sol";
import "../LibAppStorage.sol";
import "../LibSafeMath32.sol";

/**
 * @author Publius
 * @title Oracle tracks the TWAP price of the USDC/ETH and BEAN/ETH Uniswap pairs.
 **/

interface IMeta3CurveOracle {
    function block_timestamp_last() external view returns (uint256);

    function get_price_cumulative_last()
        external
        view
        returns (uint256[2] memory);

    function get_balances() external view returns (uint256[2] memory);
}

library LibCurveOracle {
    int256 private constant mintPrecision = 100;
    uint256 private constant MAX_DELTA_B_DENOMINATOR = 100;

    event MetapoolOracle(uint32 indexed season, int256 deltaB, uint256[2] balances);

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    function check() internal view returns (int256 deltaB) {
        deltaB = _check();
        deltaB = checkForMaxDeltaB(deltaB);
    }

    function _check() internal view returns (int256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            (int256 db, , ) = twaDeltaB();
            int256 mintedSeasons = int256(
                s.season.current.sub(s.co.startSeason)
            );
            mintedSeasons = mintedSeasons > mintPrecision
                ? mintPrecision
                : mintedSeasons;
            return (db * mintedSeasons) / mintPrecision;
        } else {
            return 0;
        }
    }

    function capture() internal returns (int256 deltaB, uint256[2] memory balances) {
        (deltaB, balances) = _capture();
        deltaB = checkForMaxDeltaB(deltaB);
    }

    // balances stores the twa balances throughout the season.
    // In the case of initializeOracle, it will be the current balances.
    function _capture() internal returns (int256 deltaB, uint256[2] memory balances) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            int256 mintedSeasons = int256(
                s.season.current.sub(s.co.startSeason)
            );
            mintedSeasons = mintedSeasons > mintPrecision
                ? mintPrecision
                : mintedSeasons;
            (deltaB, balances) = updateOracle();
            deltaB = (deltaB * mintedSeasons) / mintPrecision;
        } else {
            balances = initializeOracle();
        }
    }

    function initializeOracle() internal returns (uint256[2] memory current_balances) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.Oracle storage o = s.co;
        uint256[2] memory balances = IMeta3CurveOracle(C.curveMetapoolAddress())
            .get_price_cumulative_last();
        uint256 timestamp = IMeta3CurveOracle(C.curveMetapoolAddress()).block_timestamp_last();
        if (balances[0] != 0 && balances[1] != 0 && timestamp != 0) {
            (current_balances, o.balances, o.timestamp) = get_cumulative();
            o.initialized = true;
        }
    }

    function updateOracle() internal returns (int256 deltaB, uint256[2] memory balances) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (deltaB, balances, s.co.balances) = twaDeltaB();
        emit MetapoolOracle(s.season.current, deltaB, s.co.balances);
        s.co.timestamp = block.timestamp;
    }

    function twaDeltaB()
        internal
        view
        returns (int256 deltaB, uint256[2] memory balances, uint256[2] memory cum_balances)
    {
        (balances, cum_balances) = twap();
        uint256 d = LibBeanMetaCurve.getDFroms(balances);
        deltaB = LibBeanMetaCurve.getDeltaBWithD(balances[0], d);
    }

    function twap()
        internal
        view
        returns (uint256[2] memory balances, uint256[2] memory cum_balances)
    {
        cum_balances = IMeta3CurveOracle(C.curveMetapoolAddress()).get_price_cumulative_last();
        balances = IMeta3CurveOracle(C.curveMetapoolAddress()).get_balances();
        uint256 lastTimestamp = IMeta3CurveOracle(C.curveMetapoolAddress()).block_timestamp_last();

        cum_balances[0] = cum_balances[0].add(
            balances[0].mul(block.timestamp.sub(lastTimestamp))
        );
        cum_balances[1] = cum_balances[1].add(
            balances[1].mul(block.timestamp.sub(lastTimestamp))
        );

        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.Oracle storage o = s.co;

        uint256 deltaTimestamp = block.timestamp.sub(o.timestamp);

        balances[0] = cum_balances[0].sub(o.balances[0]).div(deltaTimestamp);
        balances[1] = cum_balances[1].sub(o.balances[1]).div(deltaTimestamp);
    }

    function get_cumulative()
        private
        view
        returns (uint256[2] memory balances, uint256[2] memory cum_balances, uint256 lastTimestamp)
    {
        cum_balances = IMeta3CurveOracle(C.curveMetapoolAddress()).get_price_cumulative_last();
        balances = IMeta3CurveOracle(C.curveMetapoolAddress()).get_balances();
        lastTimestamp = IMeta3CurveOracle(C.curveMetapoolAddress()).block_timestamp_last();

        cum_balances[0] = cum_balances[0].add(
            balances[0].mul(block.timestamp.sub(lastTimestamp))
        );
        cum_balances[1] = cum_balances[1].add(
            balances[1].mul(block.timestamp.sub(lastTimestamp))
        );
        lastTimestamp = block.timestamp;
    }

    function checkForMaxDeltaB(int256 deltaB) private view returns (int256) {
        int256 maxDeltaB = int256(C.bean().totalSupply().div(MAX_DELTA_B_DENOMINATOR));
        if (deltaB < 0) return deltaB > -maxDeltaB ? deltaB : -maxDeltaB;
        return deltaB < maxDeltaB ? deltaB : maxDeltaB;
    }
}
