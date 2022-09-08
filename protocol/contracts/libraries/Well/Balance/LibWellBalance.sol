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
        if (w.tokens.length == 2) return LibWell2.getBalances(wh);
        else return LibWellN.getBalances(wh, w.tokens.length);
    }

    // From Info

    function getBalances(LibWellStorage.WellInfo memory w) internal view returns (uint128[] memory balances) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        if (w.tokens.length == 2) return LibWell2.getBalances(wh);
        else return LibWellN.getBalances(wh, w.tokens.length);
    }

    function getCumulativeBalances(LibWellStorage.WellInfo memory w) internal view returns (uint224[] memory cb, uint32 lastTimestamp) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        if (w.tokens.length == 2) return LibWell2.getCumulativeBalances(wh);
        else return LibWellN.getCumulativeBalances(wh, w.tokens.length);
    }

    function getEmaBalances(LibWellStorage.WellInfo memory w) internal view returns (uint128[] memory balances) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        if (w.tokens.length == 2) return LibWell2.getEmaBalances(wh);
        else return LibWellN.getEmaBalances(wh, w.tokens.length);
    }

    function getWellState(LibWellStorage.WellInfo memory w) internal view returns (LibWellStorage.Balances memory s) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        if (w.tokens.length > 0) return LibWell2.getWellState(wh);
        return LibWellN.getWellState(wh, w.tokens.length);
    }

    // From Hash

    function getBalancesFromHash(bytes32 wh) internal view returns (uint128[] memory balances) {
        LibWellStorage.B2 storage s2 = LibWellStorage.wellStorage().w2s[wh];
        if (s2.balance0 > 0) return LibWell2.getBalances(wh);
        return LibWellN.getBalances(wh, LibWellStorage.wellStorage().wNs[wh].balances.length);
    }

    function getCumulativeBalancesFromHash(bytes32 wh) internal view returns (uint224[] memory cb, uint32 lastTimestamp) {
        LibWellStorage.B2 storage s2 = LibWellStorage.wellStorage().w2s[wh];
        if (s2.timestamp > 0) return LibWell2.getCumulativeBalances(wh);
        return LibWellN.getCumulativeBalances(wh, LibWellStorage.wellStorage().wNs[wh].balances.length);
    }

    function getWellStateFromHash(bytes32 wh) internal view returns (LibWellStorage.Balances memory s) {
        LibWellStorage.B2 storage s2 = LibWellStorage.wellStorage().w2s[wh];
        if (s2.timestamp > 0) return LibWell2.getWellState(wh);
        return LibWellN.getWellState(wh, LibWellStorage.wellStorage().wNs[wh].balances.length);
    }

    function getEmaBalancesFromHash(bytes32 wh) internal view returns (uint128[] memory balances) {
        LibWellStorage.B2 storage s2 = LibWellStorage.wellStorage().w2s[wh];
        if (s2.emaBalance0 > 0) return LibWell2.getEmaBalances(wh);
        return LibWellN.getEmaBalances(wh, LibWellStorage.wellStorage().wNs[wh].balances.length);
    }

    // From Id

    function getBalance(
        address lpToken,
        uint256 iToken
    ) internal view returns (uint128 balance) {
        bytes32 wh = LibWellStorage.wellHash(lpToken);
        balance = LibWell2.getBalance(wh, iToken);
        if (balance == 0) balance = LibWellN.getBalance(wh, iToken);
    }

    function getEmaBalance(
        address lpToken,
        uint256 iToken
    ) internal view returns (uint128 balance) {
        bytes32 wh = LibWellStorage.wellHash(lpToken);
        balance = LibWell2.getEmaBalance(wh, iToken);
        if (balance == 0) balance = LibWellN.getEmaBalance(wh, iToken);
    }
}
