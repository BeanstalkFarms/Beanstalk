/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../LibMath.sol";
import "../../LibByteStorage.sol";

/**
 * @author Publius
 * @title LibEmaPump implements a Geometric EMA pump.
 **/
library LibEmaPump {
    function updatePump(
        bytes32 slot,
        uint128[] memory balances,
        uint32 blocksPassed,
        uint A
    ) internal {
        uint256 aExp = LibPRBMath.powu(A, blocksPassed);
        uint128[] memory pumpBalances = LibByteStorage.readUint128(slot, balances.length);
        for (uint256 i; i < balances.length; ++i) {
            pumpBalances[i] = LibMath.calcEma(
                pumpBalances[i],
                balances[i],
                aExp
            );
        }
        LibByteStorage.storeUint128(slot, pumpBalances);
    }

    function readPump(
        bytes32 wellPumpId,
        uint256 n
    ) internal view returns (uint256[] memory balances) {
        balances = LibByteStorage.readUint128IntoUint256(wellPumpId, n);
    }
}
