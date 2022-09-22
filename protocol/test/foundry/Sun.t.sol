// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

import { Sun } from "@beanstalk/farm/facets/SeasonFacet/Sun.sol";
import { MockSeasonFacet } from "@beanstalk/mocks/mockFacets/MockSeasonFacet.sol";
import { MockSiloFacet } from "@beanstalk/mocks/mockFacets/MockSiloFacet.sol";
import { MockFieldFacet } from "@beanstalk/mocks/mockFacets/MockFieldFacet.sol";

import { Utils } from "./utils/Utils.sol";
import { DiamondDeployer } from "./utils/Deploy.sol";

import "@beanstalk/farm/AppStorage.sol";
import "@beanstalk/libraries/Decimal.sol";
import "@beanstalk/libraries/LibSafeMath32.sol";

contract SunTest is Sun, Test {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;

  Utils internal utils;
  address payable[] internal users;
  address internal alice;

  MockSeasonFacet internal season;
  MockSiloFacet internal silo;
  MockFieldFacet internal field;
  
  function setUp() public {
    utils = new Utils();
    users = utils.createUsers(2);
    alice = users[0];
    vm.label(alice, "Alice");

    // deploy
    address diamond = address(new DiamondDeployer().deployMock());

    season = MockSeasonFacet(diamond);
    silo = MockSiloFacet(diamond);
    field = MockFieldFacet(diamond);
    console.log("Sun: Initialized at season %s", season.season());
    
    season.siloSunrise(0);
  }

  ///////////////////////// Utilities /////////////////////////

  function _reset(uint256 _snapId) internal returns (uint256) {
    vm.revertTo(_snapId);
    return vm.snapshot();
  }

  ///////////////////////// Reentrancy /////////////////////////

  function testFail_preventReentrance() public {
    season.reentrancyGuardTest(); // should revert
  }

  ///////////////////////// Emits Soil() /////////////////////////

  function test_deltaB_negative(int256 deltaB) public {
    vm.assume(deltaB < 0);
    vm.expectEmit(true, false, false, true);
    emit Soil(season.season() + 1, uint256(-deltaB)); // sunSunrise should emit this; ASK ABOUT CASTING
    season.sunSunrise(deltaB, 8); // deltaB = -100
  }

  function test_deltaB_zero() public {
    vm.expectEmit(true, false, false, true);
    emit Soil(season.season() + 1, 0); // sunSunrise should emit this
    season.sunSunrise(0, 8); // deltaB = 0
  }

  // function test_deltaB_positive() public {
  //   vm.revertTo(snapId);
  //   vm.expectEmit(true, false, false, true);
  //   emit Soil(season.season() + 1, 0); // sunSunrise should emit this
  //   season.sunSunrise(100e6, 8); // deltaB = 100
  // }

  ///////////////////////// Pod Rate sets Soil /////////////////////////

  function test_deltaB_positive_podRate() public {
    uint256 snapId = vm.snapshot();

    // low pod rate
    field.incrementTotalPodsE(100);
    season.sunSunrise(300e6, 0); // deltaB = +300; case 0 = low pod rate
    assertEq(field.totalSoil(), 148); // FIXME: how calculated?
    snapId = _reset(snapId);

    // medium pod rate
    field.incrementTotalPodsE(100);
    season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
    assertEq(field.totalSoil(), 99); // FIXME: how calculated?
    snapId = _reset(snapId);

    // high pod rate
    field.incrementTotalPodsE(100);
    season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
    assertEq(field.totalSoil(), 99); // FIXME: how calculated?
  }

  ///////////////////////// Minting /////////////////////////

  function test_mint_siloOnly(int256 deltaB) public {
    vm.assume(deltaB > 0);
    vm.assume(deltaB < 1e16); // FIXME: right way to prevent overflows
    
    uint256 beans = uint256(deltaB); // will be positive

    vm.expectEmit(true, false, false, true);
    emit Reward(season.season() + 1, 0, beans, 0); // 100% of beans go toSilo
    vm.expectEmit(true, false, false, true);
    emit Soil(season.season() + 1, 0);

    season.sunSunrise(deltaB, 8); // deltaB = +100

    assertEq(silo.totalStalk(), beans * 1e4); // 6 -> 10 decimals
    assertEq(silo.totalEarnedBeans(), beans);
  }

  function test_mint_siloAndField(int256 deltaB) public {
    vm.assume(deltaB > 0);
    vm.assume(deltaB < 1e16);

    //
    field.incrementTotalPodsE(150);

    uint256 caseId = 8;
    uint256 beans = uint256(deltaB);
    uint256 toSilo = beans.div(2);
    uint256 toField = beans.div(2);
    uint256 soil = toField.mul(100).div(100 + s.w.yield); // hardcode for case id 8 when deltaB > 0

    vm.expectEmit(true, false, false, true);
    emit Reward(season.season() + 1, toSilo, toField, 0);
    vm.expectEmit(true, false, false, true);
    emit Soil(season.season() + 1, 0);
  }

  ///////////////////////// Alternatives /////////////////////////

  // function test_deltaB_positive_podRate_low() public {
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 0); // deltaB = +300; case 0 = low pod rate
  //   assertEq(field.totalSoil(), 148); // FIXME: how calculated?
  // }
  
  // function test_deltaB_positive_podRate_medium() public {
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
  //   assertEq(field.totalSoil(), 99); // FIXME: how calculated?
  // }

  // function test_deltaB_positive_podRate_high() public {
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
  //   assertEq(field.totalSoil(), 99); // FIXME: how calculated?
  // }
}