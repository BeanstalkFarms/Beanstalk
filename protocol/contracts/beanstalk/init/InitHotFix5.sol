/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "~/libraries/LibSafeMath128.sol";


/**
 * @author Publius
 * @title InitHotFix5
**/

interface IBs {
    function updateSilo(address account) external;
}

contract InitHotFix5 {
    AppStorage internal s;

    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    address private constant AFFECTED_ADDRESS = address(0xC849A498B4D98c80dfbC1A24F35EF234A9BA05D5);

    function init() external {

        IBs(address(this)).updateSilo(AFFECTED_ADDRESS);

        uint256 expectedRoots = s.s.roots.mul(s.a[AFFECTED_ADDRESS].s.stalk).div(s.s.stalk);
        uint256 actualRoots = s.a[AFFECTED_ADDRESS].roots;

        uint256 diffRoots = expectedRoots.sub(actualRoots);

        s.a[AFFECTED_ADDRESS].roots = s.a[AFFECTED_ADDRESS].roots.add(uint128(diffRoots));
        s.s.roots = s.s.roots.add(diffRoots);
    }
}
