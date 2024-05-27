/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;
import {AppStorage} from "../AppStorage.sol";

/**
 * @author Brean
 * @notice InitReseed reseeds Beanstalk.
 */
contract InitReseed {
    AppStorage internal s;

    function init(address fertilizerImplementation) external {
        s.season.lastSop = 0;
        s.isFarm = 1;
        s.co.initialized = false;
        s.co.startSeason = s.season.current + 1;
        s.season.withdrawSeasons = 1;
        s.earnedBeans = 0;
        // 4 Sunrises were missed before Beanstalk was paused.
        s.season.start = s.season.start + 14400;

        C.fertilizerAdmin().upgrade(C.fertilizerAddress(), fertilizerImplementation);
        C.fertilizer().setURI("https://fert.bean.money/");
    }
}
