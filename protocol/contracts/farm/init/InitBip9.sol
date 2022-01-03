/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitBip8 runs the code for BIP-8.
**/

contract InitBip9 {

    AppStorage internal s;
    
    address constant BROKEN_ACCOUNT = address(0x0b8e605A7446801ae645e57de5AAbbc251cD1e3c);

    function init() external {
        s.season.withdrawSeasons = 25;
        s.a[BROKEN_ACCOUNT].lastRain = 0;
    }
}