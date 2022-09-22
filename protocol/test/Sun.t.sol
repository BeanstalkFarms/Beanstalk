// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { Bean } from "../contracts/tokens/Bean.sol";
import { MockSeasonFacet } from "../contracts/mocks/mockFacets/MockSeasonFacet.sol";
import { Utils } from "./utils/Utils.sol";
import { DiamondDeployer } from "./utils/Deploy.sol";

contract SunTest is Test {
  Utils internal utils;
  address payable[] internal users;
  address internal alice;

  //
  MockSeasonFacet internal season;

  function setUp() public {
    utils = new Utils();
    users = utils.createUsers(2);
    alice = users[0];
    vm.label(alice, "Alice");
    
    address diamond = address(new DiamondDeployer().deployMock());

    season = MockSeasonFacet(diamond);

    console.log("Sun: Initialized at season %s", season.season());
  }
  // uint256 snapId = vm.snapshot();
  //mockSeasonFacet.siloSunrise(0); // currently failing 

  function testFail_preventReentrance() public {
    season.reentrancyGuardTest(); // should revert
  }

  // function test_negDeltaB() public {
  //   vm.expectEmit();
  //   emit Soil();
  //   mockSeasonFacet.sunSunrise(-100e6, 8); // case id = 8
  // }
}