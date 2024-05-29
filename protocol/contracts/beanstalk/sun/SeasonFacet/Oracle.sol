// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {LibRedundantMathSigned256} from "contracts/libraries/LibRedundantMathSigned256.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

/**
 * @title Oracle
 * @author Publius, Chaikitty, Brean
 * @notice Tracks the Delta B in available pools.
 */
contract Oracle is ReentrancyGuard {
    using LibRedundantMathSigned256 for int256;

    //////////////////// ORACLE INTERNAL ////////////////////

    function stepOracle() internal returns (int256 deltaB) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        for (uint256 i = 0; i < tokens.length; i++) {
            deltaB = deltaB.add(LibWellMinting.capture(tokens[i]));
        }
        s.sys.season.timestamp = block.timestamp;
    }
}
