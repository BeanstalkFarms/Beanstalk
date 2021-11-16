/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

contract InitHotFix3 {
    AppStorage internal s;

    function init() external {
        s.hotFix3Start = s.season.current;
        s.legSI.stalk = s.s.stalk - s.si.stalk;
        s.legSI.roots = s.s.roots;
        s.legSI.beans = s.si.beans;
        s.si.beans = 0;
    }

}
