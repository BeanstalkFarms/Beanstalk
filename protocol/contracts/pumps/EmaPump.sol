/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../libraries/LibMath.sol";
import "../libraries/LibByteStorage.sol";
import "../interfaces/IPump.sol";

/**
 * @author Publius
 * @title EmaPump is a stand alone Ema Pump 
 **/
contract EmaPump is IPump {

    function updatePump(
        bytes calldata pumpData,
        bytes32 wellPumpId,
        uint128[] calldata balances,
        uint32 blocksPassed
    ) external override {
        bytes16 A;
        assembly { A := calldataload(pumpData.offset) }
        uint256 aExp = LibPRBMath.powu(uint128(A), blocksPassed);
        uint128[] memory pumpBalances = LibByteStorage.readUint128(
            wellPumpId,
            balances.length
        );
        for (uint256 i; i < balances.length; ++i) {
            pumpBalances[i] = LibMath.calcEma(
                pumpBalances[i],
                balances[i],
                aExp
            );
        }
        LibByteStorage.storeUint128(wellPumpId, pumpBalances);
    }

    function readPump(
        bytes calldata pumpData,
        bytes32 wellPumpId,
        uint256 n
    ) external view override returns (uint256[] memory balances) {
        balances = LibByteStorage.readUint128IntoUint256(wellPumpId, n);
    }
}
