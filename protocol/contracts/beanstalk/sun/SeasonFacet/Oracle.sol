// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibWellMinting} from "contracts/libraries/Minting/LibWellMinting.sol";
import {SignedSafeMath} from "@openzeppelin/contracts/math/SignedSafeMath.sol";


/**
 * @title Oracle
 * @author Publius, Chaikitty, Brean
 * @notice Tracks the Delta B in available pools.
 */
contract Oracle is ReentrancyGuard {
    
    using SignedSafeMath for int256;

    //////////////////// ORACLE INTERNAL ////////////////////

    function stepOracle() internal returns (int256 deltaB) {
        deltaB = LibWellMinting.capture(C.BEAN_ETH_WELL);
        s.season.timestamp = block.timestamp;
    }
}
