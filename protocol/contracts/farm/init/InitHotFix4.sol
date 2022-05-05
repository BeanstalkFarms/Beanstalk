/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author Publius
 * @title InitHotFix4
**/
contract InitHotFix4 {
    AppStorage internal s;

    using SafeMath for uint256;

    function init() external {
        // Migrate farmable Beans to Legacy V2 system
        // s.v2SIBeans = s.si.beans;
        // s.si.beans = 0;

        // Remove all exiting farmable Stalk
        // s.s.stalk = s.s.stalk.sub(s.si.stalk);
        // s.si.stalk = 0;

        // Increment unclaimed Roots to total for previous misallocation
        // s.unclaimedRoots = s.unclaimedRoots.add(11_941_504_984_220_113_756_780_626_858);
    }
}
