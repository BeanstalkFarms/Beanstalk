/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitBip2 runs the code for BIP-2. It adjusts the Weather Cases
**/
contract InitBip2 {

    AppStorage internal s;

    function init() external {
        s.cases = [int8(3),1,0,0,-1,-3,-3,0,3,1,0,0,-1,-3,-3,0,3,3,1,0,0,-1,-3,0,3,3,1,0,1,-1,-3,0];
    }
}