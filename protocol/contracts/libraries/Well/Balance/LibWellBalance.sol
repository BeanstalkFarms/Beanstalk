/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibWell2.sol";
import "./LibWellN.sol";

/**
 * @author Publius
 * @title LibWellBalance provides a user-friendly interface to perform
 * operations on different Well Storage structs
 * Well balances are stored in the B2 and BN structs
 * B2 is a storage efficient struct for Wells with 2 tokens
 * BN is a storage efficient struct ofr Wells with N tokens
 **/
library LibWellBalance {

    /**
     * State
    **/

    function setBalances(bytes32 wh, uint128[] memory balances) internal {
        if (balances.length == 2) LibWell2.setBalances(wh, balances);
        else LibWellN.setBalances(wh, balances);
    }

    function getBalancesWithHash(LibWellStorage.WellInfo calldata w, bytes32 wh) internal view returns (uint128[] memory balances) {
        balances = getBalancesFromHash(wh, w.tokens.length);
    }

    // From Hash

    function getBalancesFromHash(bytes32 wh, uint256 n) internal view returns (uint128[] memory) {
        if (n == 2) return LibWell2.getBalances(wh);
        return LibWellN.getBalances(wh, n);
    }

    function getCumulativeBalancesFromHash(bytes32 wh, uint256 n) internal view returns (uint224[] memory, uint32) {
        if (n == 2) return LibWell2.getCumulativeBalances(wh);
        return LibWellN.getCumulativeBalances(wh, n);
    }

    function getEmaBalancesFromHash(bytes32 wh, uint256 n) internal view returns (uint128[] memory) {
        if (n == 2) return LibWell2.getEmaBalances(wh);
        return LibWellN.getEmaBalances(wh, n);
    }

    function getWellStateFromHash(bytes32 wh, uint256 n) internal view returns (LibWellStorage.Balances memory) {
        if (n == 2) return LibWell2.getWellState(wh);
        return LibWellN.getWellState(wh, n);
    }

    // From Info

    function getBalances(LibWellStorage.WellInfo memory w) internal view returns (uint128[] memory balances) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        balances = getBalancesFromHash(wh, w.tokens.length);
    }

    function getCumulativeBalances(LibWellStorage.WellInfo memory w) internal view returns (uint224[] memory cb, uint32 lastTimestamp) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        (cb, lastTimestamp) = getCumulativeBalancesFromHash(wh, w.tokens.length);
    }

    function getEmaBalances(LibWellStorage.WellInfo memory w) internal view returns (uint128[] memory balances) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        balances = getEmaBalancesFromHash(wh, w.tokens.length);
    }

    function getWellState(LibWellStorage.WellInfo memory w) internal view returns (LibWellStorage.Balances memory s) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        s = getWellStateFromHash(wh, w.tokens.length);
    }

    // From Id

    function getBalancesFromId(address wellId) internal view returns (uint128[] memory balances) {
        uint256 n = LibWellStorage.getN(wellId);
        bytes32 wh = LibWellStorage.getWellHash(wellId);
        balances = LibWellBalance.getBalancesFromHash(wh, n);
    }

    function getCumulativeBalancesFromId(address wellId) internal view returns (uint224[] memory, uint32) {
        uint256 n = LibWellStorage.getN(wellId);
        bytes32 wh = LibWellStorage.getWellHash(wellId);
        return LibWellBalance.getCumulativeBalancesFromHash(wh, n);
    }

    function getEmaBalancesFromId(address wellId) internal view returns (uint128[] memory balances) {
        uint256 n = LibWellStorage.getN(wellId);
        bytes32 wh = LibWellStorage.getWellHash(wellId);
        balances = LibWellBalance.getEmaBalancesFromHash(wh, n);
    }

    function getWellStateFromId(address wellId) internal view returns (LibWellStorage.Balances memory) {
        uint256 n = LibWellStorage.getN(wellId);
        bytes32 wh = LibWellStorage.getWellHash(wellId);
        return LibWellBalance.getWellStateFromHash(wh, n);
    }
}
