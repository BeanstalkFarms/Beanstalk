/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/OracleFacet.sol";

/**
 * @author Publius
 * @title Mock Oracle Facet
**/

interface ResetPool {
    function reset_cumulative() external;
}

interface Oracle {
    function capture() external returns (int256);
}
contract MockOracleFacet is OracleFacet {

    event UpdateTWAPs(uint256[2] balances);
    event DeltaB(int256 deltaB);

    function captureE() external returns (int256 deltaB) {
        deltaB = Oracle(address(this)).capture();
        emit DeltaB(deltaB);
    }

    function captureCurveE() external returns (int256 deltaB) {
        deltaB = LibCurveOracle.capture();
        emit DeltaB(deltaB);
    }

    function updateTWAPCurveE() external returns (uint256[2] memory balances) {
        (balances,s.co.balances) = LibCurveOracle.twap();
        s.co.timestamp = block.timestamp;
        emit UpdateTWAPs(balances);
    }

    function uniswapOracle() external view returns (Storage.Oracle memory) {
        return s.o;
    }

    function curveOracle() external view returns (Storage.COracle memory) {
        return s.co;
    }

    function timestamp() external view returns (uint32) {
        return s.o.timestamp;
    }

    function resetPools(address[] calldata pools) external {
        for (uint i = 0; i < pools.length; i++) {
            ResetPool(pools[i]).reset_cumulative();
        }
    }

}
