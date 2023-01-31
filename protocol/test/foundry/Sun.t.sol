// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "test/foundry/utils/TestHelper.sol";
import { Sun } from "~/beanstalk/sun/SeasonFacet/Sun.sol";
import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

import "~/libraries/LibSafeMath32.sol";
import "~/libraries/LibPRBMath.sol";

contract SunTest is  Sun, TestHelper {
  using SafeMath for uint256;
  using LibPRBMath for uint256;
  using LibSafeMath32 for uint32;
  
  function setUp() public {
    setupDiamond();
    // Mint beans
    C.bean().mint(address(this), 1000);
    console.log("Sun: Bean supply is", C.bean().totalSupply());
    // FIXME: Setup silo 
    season.siloSunrise(0);
  }

  ///////////////////////// Utilities /////////////////////////

  function _testSunrise(
    int256 deltaB,
    uint256 newBeans,
    uint256 pods,
    bool hasFert,
    bool hasField
  ) 
    internal 
    returns ( 
      uint256 toFert, 
      uint256 toField, 
      uint256 toSilo, 
      uint256 newHarvestable, 
      uint256 soil
    ) 
  {
    uint256 caseId  = 8;
    toFert  = hasFert  ? newBeans.div(3) : uint256(0); //
    toField = hasField ? newBeans.sub(toFert).div(2) : uint256(0); // divide remainder by two, round down
    toField = toField > pods ? pods : toField; // send up to the amount of pods outstanding
    toSilo  = newBeans.sub(toFert).sub(toField); // all remaining beans go to silo
    uint32 nextSeason = season.season() + 1;

    assert(toFert.add(toField).add(toSilo) == newBeans); // should sum back up

    newHarvestable = s.f.harvestable + toField;
    if(deltaB > 0) {
      soil = newHarvestable;
    } else {
      soil = uint256(-deltaB);
    }

    console.log("Beans minted: %s", newBeans);
    console.log("To Fert: %s", toFert);
    console.log("To Field: %s", toField);
    console.log("To Silo: %s", toSilo);
    console.log("New Harvestable: %s", newHarvestable);
    console.log("Soil: %s", soil);
    console.log("Yield: %s", s.w.t);

    vm.expectEmit(true, false, false, true);
    emit Reward(nextSeason, toField, toSilo, toFert);
    vm.expectEmit(true, false, false, true);
    emit Soil(nextSeason, soil);

    season.sunSunrise(deltaB, caseId); // Soil emission is slightly too low
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

  function test_deltaB_positive_podRate_low() public {
    field.incrementTotalPodsE(100);
    season.sunSunrise(300, 0); // deltaB = +300; case 0 = low pod rate
    vm.roll(26); // after dutch Auction
    assertEq(uint256(field.totalSoil()), 150); 
    // 300/3 = 100 *1.5 = 150
  }
  
  function test_deltaB_positive_podRate_medium() public {
    field.incrementTotalPodsE(100);
    season.sunSunrise(300, 8); // deltaB = +300; case 0 = medium pod rate
    vm.roll(26); // after dutch Auction
    assertEq(uint256(field.totalSoil()), 100); // FIXME: how calculated?
    // 300/3 = 100 * 1 = 100
  }

  function test_deltaB_positive_podRate_high() public {
    field.incrementTotalPodsE(100);
    season.sunSunrise(300, 25); // deltaB = +300; case 0 = high pod rate
    vm.roll(26); // after dutch Auction
    assertEq(uint256(field.totalSoil()), 50); // FIXME: how calculated?
    // 300/3 = 100 * 0.5 = 50

  }

  ///////////////////////// Minting /////////////////////////

  function test_mint_siloOnly(int256 deltaB) public {
    vm.assume(deltaB > 0);
    vm.assume(deltaB < 1e16); // FIXME: right way to prevent overflows
    uint256 newBeans = _abs(deltaB); // will be positive

    _testSunrise(deltaB, newBeans, 0, false, false);

    // @note only true if we've never minted to the silo before
    assertEq(silo.totalStalk(), newBeans * 1e4); // 6 -> 10 decimals
    assertEq(silo.totalEarnedBeans(), newBeans);
  }

  function test_mint_siloAndField_someHarvestable(int256 deltaB, uint256 pods) public {
    vm.assume(deltaB > 0);
    vm.assume(deltaB < 1e16);
    uint256 newBeans = _abs(deltaB); // FIXME: more efficient way to do this?
    vm.assume(pods > newBeans); // don't clear the whole pod line

    // Setup pods
    field.incrementTotalPodsE(pods);
    console.log("Pods outstanding: %s", pods);

    (/*uint256 toFert, uint256 toField*/, , uint256 toSilo, , /*uint256 newHarvestable, uint256 soil*/) 
      = _testSunrise(deltaB, newBeans, pods, false, true);

    // @note only true if we've never minted to the silo before
    assertEq(silo.totalStalk(), toSilo * 1e4); // 6 -> 10 decimals
    assertEq(silo.totalEarnedBeans(), toSilo);
  }

  function test_mint_siloAndField_allHarvestable(int256 deltaB, uint256 pods) public {
    vm.assume(deltaB > 0);
    vm.assume(deltaB < 1e16);
    uint256 newBeans = _abs(deltaB); // FIXME: more efficient way to do this?
    vm.assume(pods < newBeans); // clear the whole pod line
    // Setup pods
    field.incrementTotalPodsE(pods);
    console.log("Pods outstanding: %s", pods);

    (/*uint256 toFert, uint256 toField, */, , uint256 toSilo, uint256 newHarvestable,/* uint256 soil*/) 
      = _testSunrise(deltaB, newBeans, pods, false, true);

    // @note only true if we've never minted to the silo before
    assertEq(silo.totalStalk(), toSilo * 1e4); // 6 -> 10 decimals
    assertEq(silo.totalEarnedBeans(), toSilo);
    assertEq(field.totalHarvestable(), newHarvestable);
  }

  ///////////////////////// Alternatives /////////////////////////

  // function test_deltaB_positive_podRate() public {
  //   uint256 snapId = vm.snapshot();

  //   // low pod rate
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 0); // deltaB = +300; case 0 = low pod rate
  //   assertEq(uint256(field.totalSoil()), 148); // FIXME: how calculated?
  //   snapId = _reset(snapId);

  //   // medium pod rate
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
  //   assertEq(uint256(field.totalSoil()), 99); // FIXME: how calculated?
  //   snapId = _reset(snapId);

  //   // high pod rate
  //   field.incrementTotalPodsE(100);
  //   season.sunSunrise(300e6, 8); // deltaB = +300; case 0 = low pod rate
  //   assertEq(uint256(field.totalSoil()), 99); // FIXME: how calculated?
  // }

  function testMockOraclePrice() public {
    MockUniswapV3Pool(C.UniV3EthUsdc()).setOraclePrice(1000e6,18);
    console.log("Eth Price is:", season.getEthPrice());
    assertApproxEqRel(season.getEthPrice(),1000e6,0.01e18); //0.01% accuracy as ticks are spaced 0.01%
  }

  //helper
  function getEthUsdcPrice() private view returns (uint256) {
        (int24 tick,) = OracleLibrary.consult(C.UniV3EthUsdc(),3600); //1 season tick
        return OracleLibrary.getQuoteAtTick(
            tick,
            1e18,
            address(C.weth()),
            address(C.usdc())
        );
    }

}