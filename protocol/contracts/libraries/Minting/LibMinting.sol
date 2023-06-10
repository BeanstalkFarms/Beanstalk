/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius
 * @title Well Minting calculates the deltaB in a Well over a given Season.
 **/


library LibMinting {

    using SafeMath for uint256;

    uint256 private constant MAX_DELTA_B_DENOMINATOR = 100;

    function checkForMaxDeltaB(int256 deltaB) internal view returns (int256) {
        int256 maxDeltaB = int256(C.bean().totalSupply().div(MAX_DELTA_B_DENOMINATOR));
        if (deltaB < 0) return deltaB > -maxDeltaB ? deltaB : -maxDeltaB;
        return deltaB < maxDeltaB ? deltaB : maxDeltaB;
    }

}