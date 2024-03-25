// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import "./utils/TestHelper.sol";

contract SiloTest is TestHelper {
    MockSeasonFacet season = MockSeasonFacet(BEANSTALK);
  
    function setUp() public {
        initializeBeanstalkTestState(true);
        
        // mint 1000 beans to user 1 and user 2 (user 0 is the beanstalk deployer).
        address[] memory farmers = new address[](2);
        farmers[0] = users[1]; farmers[1] = users[2];
        mintTokensToUsers(farmers, C.BEAN, 1000e6);
    }

    function testAAA() public {
        // test something
        season.siloSunrise(100);
    }
}