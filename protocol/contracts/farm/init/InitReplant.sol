/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";

/**
 * @author Publius
 * @title InitReplant the replanting of Beanstalk.
**/

contract InitReplant {

    AppStorage internal s;

    function init() external {
        s.earnedBeans = 0;
        s.earnedPlenty = 0;
        s.season.lastSop = 0;
        s.co.initialized = false;
        s.season.withdrawSeasons = 5;
    }
}