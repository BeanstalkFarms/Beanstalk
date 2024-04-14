/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibTractor} from "../../libraries/LibTractor.sol";

/**
 * @author 0xm00neth
 * @title InitTractor inits TractorStorage.
 **/
contract InitTractor {
    function init() external {
        LibTractor._resetPublisher();
    }
}