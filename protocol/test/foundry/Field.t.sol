// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { FieldFacet } from "~/beanstalk/facets/FieldFacet.sol";
import "./utils/InitDiamondDeployer.sol";
import "./utils/LibConstant.sol";

contract FieldTest is FieldFacet, Test, InitDiamondDeployer {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;
  using Decimal for Decimal.D256;

  Storage.Weather weather;
  Storage.Weather weather2;

  function setUp() public override{
    InitDiamondDeployer.setUp();
    vm.prank(brean);
    C.bean().approve(address(field),100000000000 ether);
    vm.prank(siloChad);
    C.bean().approve(address(field),100000000000 ether);
    C.bean().mint(brean, 10000 * 1e6);
    C.bean().mint(siloChad, 10000 * 1e6);
  }

  function testCannotSowWithNoSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sow(1,LibTransfer.From.EXTERNAL);
  }

  function testCannotSowBelowMinSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sowWithMin(1,3,LibTransfer.From.EXTERNAL);

  }

  function testCannotSowWithNoSoilBelowMin() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sowWithMin(1,0,LibTransfer.From.EXTERNAL);

  }

  function testSowAllSoil() public {
    _beforeEachSow();
    vm.prank(brean);
    console.log("Updates user's balance:");
    assertEq(C.bean().balanceOf(brean),9900 * 1e6);
    assertEq(field.plot(brean,0), 101 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19900 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 0);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.podIndex(), 101 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowSomeSoil() public {
    _beforeEachSomeSow();

    vm.prank(brean);
    console.log("Updates user's balance:");
    assertEq(C.bean().balanceOf(brean),9900 * 1e6);
    assertEq(field.plot(brean,0), 101 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19900 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 100 * 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.podIndex(), 101 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowSomeSoilFromInternal() public {
    _beforeEachSomeSowFromInternal();
    assertEq(C.bean().balanceOf(brean),9900 * 1e6);
    assertEq(field.plot(brean,0), 101 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19900 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 100 * 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.podIndex(), 101 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowSomeSoilFromInternalTolerant() public {
    _beforeEachSomeSowFromInternalTolerant();
    assertEq(C.bean().balanceOf(brean),9950 * 1e6);
    assertEq(field.plot(brean,0), 50.5 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19950 * 1e6);
    assertEq(field.totalPods(), 50.5 * 1e6);
    assertEq(field.totalSoil(), 150 * 1e6);
    assertEq(field.totalUnharvestable(), 50.5 * 1e6);
    assertEq(field.podIndex(), 50.5 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowMin() public {
    _beforeEachSowMin();
    assertEq(C.bean().balanceOf(brean), 9900 * 1e6);
    assertEq(field.plot(brean,0), 101 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19900 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 0* 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.podIndex(), 101 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowMinWithEnoughSoil() public {
    _beforeEachSowMinWithEnoughSoil();
    assertEq(C.bean().balanceOf(brean), 9900 * 1e6);
    assertEq(field.plot(brean,0), 101 * 1e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19900 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 100* 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.podIndex(), 101 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testSowFrom2Users() public {
    _beforeEachSow2Users();
    assertEq(C.bean().balanceOf(brean), 9900 * 1e6);
    assertEq(C.bean().balanceOf(siloChad), 9900 * 1e6);

    assertEq(field.plot(brean,0), 101 * 1e6);
    assertEq(field.plot(siloChad, 101 * 1e6), 101 * 1e6);


    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19800 * 1e6);
    assertEq(field.totalPods(), 202 * 1e6);
    assertEq(field.totalSoil(), 0* 1e6);
    assertEq(field.totalUnharvestable(), 202 * 1e6);
    assertEq(field.podIndex(), 202 * 1e6);
    assertEq(field.harvestableIndex(), 0);
  }

  function testComplexDPDMoreThan1Soil() public {
    // Does not set nextSowTime if Soil > 1;
    season.setSoilE(3* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertEq(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPD1Soil() public {
    // Does set nextSowTime if Soil = 1;
    season.setSoilE(1* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPDLessThan1Soil() public {
    // Does set nextSowTime if Soil < 1;
    season.setSoilE(1.5* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  
  }

  function testComplexDPDLessThan1SoilNoSetterino() public {
    // Does not set nextSowTime if Soil already < 1;
    season.setSoilE(1.5* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    vm.prank(siloChad);
    field.sow(0.5*1e6,LibTransfer.From.EXTERNAL);
    weather2 = season.weather();
    assertEq(uint256(weather2.nextSowTime), uint256(weather.nextSowTime));

  }

  function testCannotHarvestUnownedPlot() public {
    _beforeEachHarvest();
    field.incrementTotalHarvestableE(101 * 1e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(siloChad);
    vm.expectRevert("Field: Plot is empty.");
    field.harvest(harvestPlot,LibTransfer.To.EXTERNAL);
  }

  function testCannotHarvestUnharvestablePlot() public {
    _beforeEachHarvest();
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectRevert("Field: Plot not Harvestable.");
    field.harvest(harvestPlot,LibTransfer.To.EXTERNAL);
  }

  function testHarvestEntirePlot() public {
    _beforeEachHarvest();
    _beforeEachFullHarvest();
    //updates user balance
    assertEq(C.bean().balanceOf(brean), 10001 * 1e6);
    assertEq(field.plot(brean, 0),0);

    //updates total balance
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19901 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 0 * 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.totalHarvestable(), 0 * 1e6);
    assertEq(field.harvestableIndex(), 101 * 1e6);
    assertEq(field.totalHarvested(), 101 * 1e6);
    assertEq(field.podIndex(), 202 * 1e6);

  }
  
  function testHarvestPartialPlot() public {
    _beforeEachHarvest();
    _beforeEachPartialHarvest();
    //updates user balance
    assertEq(C.bean().balanceOf(brean), 9950 * 1e6);
    assertEq(field.plot(brean, 0),0);
    assertEq(field.plot(brean, 50 * 1e6),51 * 1e6);

    //updates total balance
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19850 * 1e6);
    assertEq(field.totalPods(), 152 * 1e6);
    assertEq(field.totalSoil(), 0 * 1e6);
    assertEq(field.totalUnharvestable(), 152 * 1e6);
    assertEq(field.totalHarvestable(), 0 * 1e6);
    assertEq(field.harvestableIndex(), 50 * 1e6);
    assertEq(field.totalHarvested(), 50 * 1e6);
    assertEq(field.podIndex(), 202 * 1e6);
  }

  function testHarvestEntirePlotWithListing() public {
    _beforeEachHarvest();
    _beforeEachHarvestEntirePlotWithListing();

    assertEq(C.bean().balanceOf(brean), 10001 * 1e6);
    assertEq(field.plot(brean, 0),0);
    //updates total balance
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), 19901 * 1e6);
    assertEq(field.totalPods(), 101 * 1e6);
    assertEq(field.totalSoil(), 0 * 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.totalHarvestable(), 0 * 1e6);
    assertEq(field.harvestableIndex(), 101 * 1e6);
    assertEq(field.totalHarvested(), 101 * 1e6);
    assertEq(field.podIndex(), 202 * 1e6);

    //deletes
    assertEq(marketplace.podListing(0), 0);
  }
  

  // BeforeEach Helpers
  function _beforeEachFullHarvest() public {
    field.incrementTotalHarvestableE(101 * 1e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot, 101* 1e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }
  function _beforeEachPartialHarvest() public {
    field.incrementTotalHarvestableE(50 * 1e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot, 50* 1e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }
  function _beforeEachHarvest() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.prank(brean);
    field.sow(100*1e6,LibTransfer.From.EXTERNAL);
    vm.prank(siloChad);
    field.sow(100*1e6,LibTransfer.From.EXTERNAL);
  }
  function _beforeEachHarvestEntirePlotWithListing() public {
    field.incrementTotalHarvestableE(101 * 1e6);
    vm.prank(brean);
    marketplace.createPodListing(0, 0, 500, 500000, 200 * 1e6, 1 * 1e6, LibTransfer.To.EXTERNAL);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot,101* 1e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }
  function _beforeEachSow() public {
    field.incrementTotalSoilE(100 * 1e6);
    vm.prank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100* 1e6,101* 1e6);
    field.sow(100* 1e6, LibTransfer.From.EXTERNAL);
  }
  function _beforeEachSomeSow() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.prank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100* 1e6,101* 1e6);
    field.sow(100* 1e6, LibTransfer.From.EXTERNAL);
  }
  function _beforeEachSomeSowFromInternal() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 100 * 1e6, LibTransfer.From.EXTERNAL,LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100* 1e6,101* 1e6);
    field.sow(100* 1e6, LibTransfer.From.INTERNAL);
    vm.stopPrank();

  }
  function _beforeEachSomeSowFromInternalTolerant() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 50 * 1e6, LibTransfer.From.EXTERNAL,LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,50 * 1e6,50.5* 1e6);
    field.sow(100* 1e6, LibTransfer.From.INTERNAL_TOLERANT);
    vm.stopPrank();
  }
  function _beforeEachSowMin() public {
    field.incrementTotalSoilE(100 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(200 * 1e6,100 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }
  function _beforeEachSowMinWithEnoughSoil() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6,50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }
  function _beforeEachSow2Users() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6,50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();

    vm.startPrank(siloChad);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(siloChad,101 * 1e6,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6,50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }

  //TODO ADD DUTCH AUCTION STUFF
}