/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "../../C.sol";
import {LibWhitelist} from "../../libraries/Silo/LibWhitelist.sol";

/**
 * @author Publius
 * @title InitReplant the replanting of Beanstalk.
**/

contract InitReplant {

    AppStorage internal s;

    function init(address fertilizerImplementation) external {
        s.season.lastSop = 0;
        s.isFarm = 1;
        s.co.initialized = false;
        s.co.startSeason = s.season.current+1;
        s.season.withdrawSeasons = 1;
        s.earnedBeans = 0;
        // 4 Sunrises were missed before Beanstalk was paused.
        s.season.start = s.season.start + 14400;

        C.fertilizerAdmin().upgrade(
            C.fertilizerAddress(), 
            fertilizerImplementation
        );
        C.fertilizer().setURI('https://fert.bean.money/');
    }
}