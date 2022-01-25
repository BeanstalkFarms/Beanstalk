/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {Storage} from "../../AppStorage.sol";

/**
 * @author LeoFib
 * @title ToolShed holds all the util helper functions and constants for Beanstalk
**/
contract ToolShed {

    /**
     * Shed
    **/

    /**
     * Getters
    **/
    function getUniswapPairAddress() internal pure returns (address) {
        return UNISWAP_PAIR_ADDRESS;
    }

    function getBeanAddress() internal pure returns (address) {
        return BEAN_ADDRESS;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

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