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
 * @title Lib Well N wraps LibWellBalance to provide an interface to read/write
 * Well balances for Wells with more than 2 tokens through the Well hash.
 **/
library LibWellN {

    /**
     * Internal
    **/

    function initBalances(bytes32 wh, uint256 n) internal {
        initBN(LibWellStorage.wellStorage().wNs[wh], n);
    }

    function setBalances(bytes32 wh, uint128[] memory balances) internal {
        setBN(LibWellStorage.wellStorage().wNs[wh], balances);
    }

    function getWellState(bytes32 wh, uint256 n) internal view returns (LibWellStorage.Balances memory s) {
        s = getBalancesStructFromBN(LibWellStorage.wellStorage().wNs[wh], n);
    }

    function getCumulativeBalances(bytes32 wh, uint256 n) internal view returns (uint224[] memory cb, uint32 lastTimestamp) {
        (cb, lastTimestamp) = getCumulativeBalancesFromBN(LibWellStorage.wellStorage().wNs[wh], n);
    }

    function getBalances(bytes32 wh, uint256 n) internal view returns (uint128[] memory balances) {
        LibWellStorage.BN storage bn = LibWellStorage.wellStorage().wNs[wh];
        balances = getBalancesFromBN(bn.balances, n);
    }

    function getBalance(bytes32 wh, uint256 i) internal view returns (uint128 balance) {
        LibWellStorage.BN storage bn = LibWellStorage.wellStorage().wNs[wh];
        balance = bn.balances[i];
    }

    function getEmaBalances(bytes32 wh, uint256 n) internal view returns (uint128[] memory balances) {
        LibWellStorage.BN storage bn = LibWellStorage.wellStorage().wNs[wh];
        balances = getBalancesFromBN(bn.emaBalances, n);
    }

    function getEmaBalance(bytes32 wh, uint256 i) internal view returns (uint128 balance) {
        LibWellStorage.BN storage bn = LibWellStorage.wellStorage().wNs[wh];
        balance = bn.emaBalances[i];
    }

    function initBN(LibWellStorage.BN storage b, uint256 n) private {
        uint256 iMax = n - 1;
        for (uint256 i; i < iMax; i++) {
            b.balances.push(0);
            b.emaBalances.push(0);
            b.cumulativeBalances.push(0);
        }
        b.balances.push(0);
        b.emaBalances.push(0);
    }

    function setBN(LibWellStorage.BN storage b, uint128[] memory balances) private {
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 passedTime = blockTimestamp - b.timestamp; // ws.lastTimestamp <= block.timestamp
        if (passedTime > 0) {
            // Overflow on addition is okay
            // overflow on multication is not possible b/c ws.balanceX <= (uint112).max and passedTime <= (uint32).max
            uint256 i;
            uint256 cbLength = balances.length-1;
            // Calculate aExp for use in ema
            uint256 aExp = LibPRBMath.powu(C.emaAlpha(), uint256(passedTime));
            for (i; i < cbLength; ++i) {
                b.cumulativeBalances[i] = b.cumulativeBalances[i] + uint224(b.balances[i]) * passedTime;
                b.emaBalances[i] = LibMath.calcEma(b.emaBalances[i], b.balances[i], aExp);
            }
            b.lastCumulativeBalance = b.lastCumulativeBalance + uint224(b.balances[i]) * passedTime;
            b.emaBalances[i] = LibMath.calcEma(b.emaBalances[i], b.balances[i], aExp);
            b.timestamp = blockTimestamp;
        }
        for (uint i; i < balances.length; ++i) b.balances[i] = balances[i];
    }

    function getBalancesFromBN(uint128[] storage balances, uint256 n) private view returns (uint128[] memory bs) {
        bs = new uint128[](n);
        for (uint i; i < n; ++i) bs[i] = balances[i];
    }

    function getCumulativeBalancesFromBN(LibWellStorage.BN storage b, uint256 n) private view returns (uint224[] memory cb, uint32 lastTimestamp) {
        cb = new uint224[](n);
        for (uint i; i < n-1; ++i)
            cb[i] = b.cumulativeBalances[i];
        cb[n-1] = b.lastCumulativeBalance;
        lastTimestamp = b.timestamp;
    }

    function getBalancesStructFromBN(LibWellStorage.BN storage b, uint256 n) private view returns (LibWellStorage.Balances memory cb) {
        cb.balances = getBalancesFromBN(b.balances, n);
        cb.emaBalances = getBalancesFromBN(b.emaBalances, n);
        (cb.cumulativeBalances, cb.timestamp) = getCumulativeBalancesFromBN(b, n);
    }

}
