/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {C} from "contracts/C.sol";

/**
 * @title Minting Library
 * @notice Contains Helper Fucntions for Minting related functionality.
 **/
library LibMinting {
    using LibRedundantMath256 for uint256;

    uint256 private constant MAX_DELTA_B_DENOMINATOR = 100;

    function checkForMaxDeltaB(int256 deltaB) internal view returns (int256) {
        int256 maxDeltaB = int256(C.bean().totalSupply().div(MAX_DELTA_B_DENOMINATOR));
        if (deltaB < 0) return deltaB > -maxDeltaB ? deltaB : -maxDeltaB;
        return deltaB < maxDeltaB ? deltaB : maxDeltaB;
    }
}
