/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

contract InitHotFix3 {
    AppStorage internal s;

    function init() external {
        s.deprecated_hotFix3Start = s.season.current;
        // s.v1SI.stalk = s.s.stalk - s.si.stalk;
        // s.v1SI.roots = s.s.roots;
        // s.v1SI.beans = s.si.beans;
        // s.si.beans = 0;
    }

}
