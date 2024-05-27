/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;
import {AppStorage} from "../AppStorage.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";

/**
 * @author Brean
 * @notice InitReseed reseeds Beanstalk.
 */
contract InitReseed {
    AppStorage internal s;

    function init() external {
        s.paused = false;
        s.isFarm = 1;
        s.earnedBeans = 0;
        LibTractor._tractorStorage().activePublisher = payable(address(1));
    }
}
