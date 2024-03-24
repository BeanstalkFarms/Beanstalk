// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "./utils/TestHelper.sol";

contract SiloTest is TestHelper {

    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
  
    function setUp() public {
        // initalize Diamond:
        setupDiamond(true);
    }

    function testAAA() public {
        season.lightSunrise();
        console.log("test");
    }
}