/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../LibWellStorage.sol";
import "../../LibMath.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title LibWell2  wraps LibWellBalance to provide an interface to read/write
 * Well balances for Wells with 2 tokens through the Well hash.
 **/
library LibWell2 {

    /**
     * Accessors with Hash
    **/

    function migrateBalances(bytes32 oldWH, bytes32 newWH) internal {
        LibWellStorage.wellStorage().w2s[newWH] = LibWellStorage.wellStorage().w2s[oldWH];
        delete LibWellStorage.wellStorage().w2s[oldWH];
    }

    function setBalances(bytes32 wh, uint128[] memory balances) internal {
        setB2(LibWellStorage.wellStorage().w2s[wh], balances);
    }

    function getWellState(bytes32 wh) internal view returns (LibWellStorage.Balances memory s) {
        s = getBalancesStructFromB2(LibWellStorage.wellStorage().w2s[wh]);
    }

    function getCumulativeBalances(bytes32 wh) internal view returns (uint224[] memory cb, uint32 lastTimestamp) {
        (cb, lastTimestamp) = getCumulativeBalancesFromB2(LibWellStorage.wellStorage().w2s[wh]);
    }

    function getBalances(bytes32 wh) internal view returns (uint128[] memory balances) {
        LibWellStorage.B2 storage b2 = LibWellStorage.wellStorage().w2s[wh];
        balances = getBalancesFromB2(b2.balance0, b2.balance1);
    }

    function getBalance(bytes32 wh, uint256 i) internal view returns (uint128 balance) {
        LibWellStorage.B2 storage b2 = LibWellStorage.wellStorage().w2s[wh];
        balance = i == 0 ? b2.balance0 : b2.balance1;
    }

    function getEmaBalances(bytes32 wh) internal view returns (uint128[] memory balances) {
        LibWellStorage.B2 storage b2 = LibWellStorage.wellStorage().w2s[wh];
        balances = getBalancesFromB2(b2.emaBalance0, b2.emaBalance1);
    }

    function getEmaBalance(bytes32 wh, uint256 i) internal view returns (uint128 balance) {
        LibWellStorage.B2 storage b2 = LibWellStorage.wellStorage().w2s[wh];
        balance = i == 0 ? b2.emaBalance0 : b2.emaBalance1;
    }

    /**
     * Private 
    **/

    function setB2(LibWellStorage.B2 storage b, uint128[] memory balances) private {
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 passedTime = blockTimestamp - b.timestamp; // ws.lastTimestamp <= block.timestamp
        if (passedTime > 0) {
            // Overflow on addition is okay
            // overflow on multication is not possible b/c ws.balanceX <= (uint128).max and passedTime <= (uint32).max
            b.cumulativeBalance0 = b.cumulativeBalance0 + uint224(b.balance0) * passedTime;
            b.cumulativeBalance1 = b.cumulativeBalance1 + uint224(b.balance1) * passedTime;
            b.timestamp = blockTimestamp;

            // Calculate aExp for use in ema
            uint256 aExp = LibPRBMath.powu(C.emaAlpha(), uint256(passedTime));
            b.emaBalance0 = LibMath.calcEma(b.emaBalance0, b.balance0, aExp);
            b.emaBalance1 = LibMath.calcEma(b.emaBalance1, b.balance1, aExp);
        }
        b.balance0 = balances[0];
        b.balance1 = balances[1];
    }

    function getBalancesFromB2(uint128 balance0, uint128 balance1) private pure returns (uint128[] memory balances) {
        balances = new uint128[](2);
        balances[0] = balance0;
        balances[1] = balance1;
    }

    function getCumulativeBalancesFromB2(LibWellStorage.B2 storage b) private view returns (uint224[] memory cb, uint32 lastTimestamp) {
        cb = new uint224[](2);
        cb[0] = b.cumulativeBalance0;
        cb[1] = b.cumulativeBalance1;
        lastTimestamp = b.timestamp;
    }

    function getBalancesStructFromB2(LibWellStorage.B2 storage b) private view returns (LibWellStorage.Balances memory bs) {
        bs.balances = getBalancesFromB2(b.balance0, b.balance1);
        bs.emaBalances = getBalancesFromB2(b.emaBalance0, b.emaBalance1);
        (bs.cumulativeBalances, bs.timestamp) = getCumulativeBalancesFromB2(b);
    }
}
