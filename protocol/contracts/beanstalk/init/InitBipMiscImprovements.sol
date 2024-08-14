/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "../../tokens/Fertilizer/Fertilizer.sol";

/**
 * @author deadmanwalking
 * @title InitBipMiscImprovements updates the Fertilizer implementation
 * to use a decentralized uri
 **/

contract InitBipMiscImprovements {
    function init() external {
        // deploy new Fertilizer implementation
        Fertilizer fertilizer = new Fertilizer();
        // get the address of the new Fertilizer implementation
        address fertilizerImplementation = address(fertilizer);

        // upgrade to new Fertilizer implementation
        C.fertilizerAdmin().upgrade(C.fertilizerAddress(), fertilizerImplementation);
    }
}
