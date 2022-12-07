/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../LibByteStorage.sol";
import "./LibWellTokens.sol";
import "./LibWellStorage.sol";
import "./Pump/LibPump.sol";

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

    function migrateBalances(bytes32 oldWH, bytes32 newWH, uint256 n) internal {
        // if (n == 2) LibWell2.migrateBalances(oldWH, newWH);
        // else LibWellN.migrateBalances(oldWH, newWH);
    }

    /**
     * Pumps
    **/

    function updateBalances(bytes32 wh, uint128[] memory balances) internal {
        setBalances(wh, balances);
    }

    function getBalancesAndUpdatePumps(bytes32 wh, uint256 n, bytes[] calldata pumps) internal returns (uint128[] memory balances) {
        balances = getBalancesFromHash(wh, n);
        LibPump.updatePumps(wh, pumps, balances);
    }

    function setBalances(bytes32 wh, uint128[] memory balances) internal {
        LibByteStorage.storeUint128(wh, balances);
    }

    function getBalances(LibWellStorage.WellInfo memory w) internal view returns (uint128[] memory balances) {
        bytes32 wh = LibWellStorage.computeWellHash(w);
        balances = getBalancesFromHash(wh, w.tokens.length);
    }

    function getBalancesFromHash(bytes32 wh, uint256 n) internal view returns (uint128[] memory balances) {
        balances = LibByteStorage.readUint128(wh, n);
    }

    function getBalancesFromId(address wellId) internal view returns (uint128[] memory balances) {
        uint256 n = LibWellTokens.getN(wellId);
        bytes32 wh = LibWellStorage.getWellHash(wellId);
        balances = LibWellBalance.getBalancesFromHash(wh, n);
    }
}
