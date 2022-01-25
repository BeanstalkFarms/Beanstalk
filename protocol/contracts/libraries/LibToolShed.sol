/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {Storage} from "../farm/AppStorage.sol";

library LibToolShed {

    /**
    * Update Settings Struct Functions
    **/

    function defaultSettings() internal returns (Storage.Settings memory set) {
        Storage.Settings memory DEFAULT_SETTINGS;
        DEFAULT_SETTINGS.toInternalBalance = false;
        DEFAULT_SETTINGS.fromInternalBalance = false;
        DEFAULT_SETTINGS.lightUpdateSilo = false;
        return DEFAULT_SETTINGS;
    }
}