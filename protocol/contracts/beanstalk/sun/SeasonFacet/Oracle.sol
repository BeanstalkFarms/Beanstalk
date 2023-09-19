// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/Minting/LibCurveMinting.sol";
import "contracts/beanstalk/ReentrancyGuard.sol";
import "contracts/libraries/Minting/LibWellMinting.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

/**
 * @title Oracle
 * @author Publius, Chaikitty
 * @notice Tracks the Delta B in available pools.
 */
contract Oracle is ReentrancyGuard {
    
    using SignedSafeMath for int256;

    //////////////////// ORACLE INTERNAL ////////////////////

    function stepOracle() internal returns (int256 deltaB) {
        deltaB = LibCurveMinting.capture();
        deltaB = deltaB.add(LibWellMinting.capture(C.BEAN_ETH_WELL));
        s.season.timestamp = block.timestamp;
    }
}
