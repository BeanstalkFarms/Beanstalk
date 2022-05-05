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
    function get_price_cumulative_last() external view returns (uint256[2] memory);
    function get_balances() external view returns (uint256[2] memory);
}

library LibCurveOracle {
    address private constant POOL = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
    int256 private constant mintPrecision = 240;

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    function check() internal view returns (int256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            (int256 db,) = twaDeltaB();
            int256 mintedSeasons = int256(s.season.current.sub(s.co.startSeason));
            mintedSeasons = mintedSeasons > mintPrecision ? mintPrecision : mintedSeasons;
            return db * mintedSeasons / mintPrecision;
        } else {
            return 0;
        }
    }

    function capture() internal returns (int256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (s.co.initialized) {
            int256 mintedSeasons = int256(s.season.current.sub(s.co.startSeason));
            mintedSeasons = mintedSeasons > mintPrecision ? mintPrecision : mintedSeasons;
            return updateOracle() * mintedSeasons / mintPrecision;
        } else {
            initializeOracle();
            return 0;
        }
    }

    function initializeOracle() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.Oracle storage o = s.co;
        uint256[2] memory balances = 
            IMeta3CurveOracle(POOL).get_price_cumulative_last();
        uint256 timestamp = IMeta3CurveOracle(POOL).block_timestamp_last();
        if (balances[0] != 0 && balances[1] != 0 && timestamp != 0) {
            (o.balances, o.timestamp) = get_cumulative();
            o.initialized = true;
        }
    }


    function updateOracle() internal returns (int256 deltaB) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        (deltaB, s.co.balances) = twaDeltaB();
        s.co.timestamp = block.timestamp;
    }

    function twaDeltaB() internal view returns (int256 deltaB, uint256[2] memory cum_balances) {
        uint256[2] memory balances;
        (balances, cum_balances) = twap();
        uint256 d = LibBeanMetaCurve.getDFroms(balances);
        deltaB = LibBeanMetaCurve.getDeltaBWithD(balances[0], d);
    }

    function twap() internal view returns (uint256[2] memory balances, uint256[2] memory cum_balances) {
        cum_balances = IMeta3CurveOracle(POOL).get_price_cumulative_last();
        balances = IMeta3CurveOracle(POOL).get_balances();
        uint256 lastTimestamp = IMeta3CurveOracle(POOL).block_timestamp_last();

        cum_balances[0] = cum_balances[0].add(balances[0].mul(block.timestamp.sub(lastTimestamp)));
        cum_balances[1] = cum_balances[1].add(balances[1].mul(block.timestamp.sub(lastTimestamp)));

        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.Oracle storage o = s.co;

        uint256 deltaTimestamp = block.timestamp.sub(o.timestamp);
        
        balances[0] = cum_balances[0].sub(o.balances[0]).div(deltaTimestamp);
        balances[1] = cum_balances[1].sub(o.balances[1]).div(deltaTimestamp);
    }

    function get_cumulative() private view returns (uint256[2] memory cum_balances, uint256 lastTimestamp) {
        cum_balances = 
            IMeta3CurveOracle(POOL).get_price_cumulative_last();
        uint256[2] memory balances = 
            IMeta3CurveOracle(POOL).get_balances();
        lastTimestamp = IMeta3CurveOracle(POOL).block_timestamp_last();

        cum_balances[0] = cum_balances[0].add(balances[0].mul(block.timestamp.sub(lastTimestamp)));
        cum_balances[1] = cum_balances[1].add(balances[1].mul(block.timestamp.sub(lastTimestamp)));
        lastTimestamp = block.timestamp;
    }
}
