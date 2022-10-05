// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { FieldFacet } from "farm/facets/FieldFacet.sol";
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
    season.farmSunrise();
    vm.prank(brean);
    C.bean().approve(address(field),1e18 ether);
    vm.prank(siloChad);
    C.bean().approve(address(field),1e18 ether);
    C.bean().mint(brean, 10000 * 1e6);
    C.bean().mint(siloChad, 10000 * 1e6);
  }

  function testCannotSowWithNoSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sow(1,1 * 1e6,LibTransfer.From.EXTERNAL);
  }

  function testCannotSowBelowMinSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sowWithMin(1,1 * 1e6,3,LibTransfer.From.EXTERNAL);

  }

  function testCannotSowWithNoSoilBelowMin() public {
    vm.prank(brean);
    vm.expectRevert("Field: Sowing below min or 0 pods.");
    field.sowWithMin(1,1 * 1e6,0,LibTransfer.From.EXTERNAL);

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
    field.sow(1*1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertEq(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPD1Soil() public {
    // Does set nextSowTime if Soil = 1;
    season.setSoilE(1* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPDLessThan1Soil() public {
    // Does set nextSowTime if Soil < 1;
    season.setSoilE(1.5* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.nextSowTime), uint256(LibConstant.MAX_UINT32));
  
  }

  function testComplexDPDLessThan1SoilNoSetterino() public {
    // Does not set nextSowTime if Soil already < 1;
    season.setSoilE(1.5* 1e6);
    vm.prank(brean);
    field.sow(1*1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    vm.prank(siloChad);
    field.sow(0.5*1e6,1,LibTransfer.From.EXTERNAL);
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
    field.sow(100*1e6,1,LibTransfer.From.EXTERNAL);
    vm.prank(siloChad);
    field.sow(100*1e6,1,LibTransfer.From.EXTERNAL);
  }
  function _beforeEachHarvestEntirePlotWithListing() public {
    field.incrementTotalHarvestableE(101 * 1e6);
    vm.prank(brean);
    marketplace.createPodListing(0, 0, 500, 500000, 200 * 1e6, LibTransfer.To.EXTERNAL);
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
    field.sow(100* 1e6, 1 * 1e6,LibTransfer.From.EXTERNAL);
  }
  function _beforeEachSomeSow() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.prank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100* 1e6,101* 1e6);
    field.sow(100* 1e6, 1 * 1e6,LibTransfer.From.EXTERNAL);
  }
  function _beforeEachSomeSowFromInternal() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 100 * 1e6, LibTransfer.From.EXTERNAL,LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100* 1e6,101* 1e6);
    field.sow(100* 1e6, 1 * 1e6, LibTransfer.From.INTERNAL);
    vm.stopPrank();

  }
  function _beforeEachSomeSowFromInternalTolerant() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 50 * 1e6, LibTransfer.From.EXTERNAL,LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,50 * 1e6,50.5* 1e6);
    field.sow(100* 1e6, 1 * 1e6, LibTransfer.From.INTERNAL_TOLERANT);
    vm.stopPrank();
  }
  function _beforeEachSowMin() public {
    field.incrementTotalSoilE(100 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(200 * 1e6,1 * 1e6,100 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }
  function _beforeEachSowMinWithEnoughSoil() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6, 1 * 1e6, 50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }
  function _beforeEachSow2Users() public {
    field.incrementTotalSoilE(200 * 1e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6, 1 * 1e6, 50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();

    vm.startPrank(siloChad);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(siloChad,101 * 1e6,100 * 1e6,101 * 1e6);
    field.sowWithMin(100 * 1e6, 1 * 1e6, 50 * 1e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  } 

  //MORNING AUCTION STUFF
  function testMorningAuctionValues(uint256 blockNo,uint32 __weather) public {
    //verify morning auction value align with manually calculated values
    uint256 _weather = bound(__weather,1,69420); // arbitary large number
    season.setYieldE(uint32(_weather));
    blockNo = bound(blockNo,1,301); // 12s block time = 300 blocks in an season
    uint256[26] memory ScaleValues;
    ScaleValues = [
      uint256(1 * 1e6),
      27.9415 * 1e6 / 100,
      40.9336 * 1e6 / 100,
      49.4912 * 1e6 / 100,
      55.8830 * 1e6 / 100,
      60.9868 * 1e6 / 100,
      65.2355 * 1e6 / 100,
      68.8751 * 1e6 / 100,
      72.0584 * 1e6 / 100,
      74.8873 * 1e6 / 100,
      77.4327 * 1e6 / 100,
      79.7465 * 1e6 / 100,
      81.8672 * 1e6 / 100,
      83.8245 * 1e6 / 100,
      85.6420 * 1e6 / 100,
      87.3382 * 1e6 / 100,
      88.9283 * 1e6 / 100,
      90.4248 * 1e6 / 100,
      91.8382 * 1e6 / 100,
      93.1771 * 1e6 / 100,
      94.4490 * 1e6 / 100,
      95.6603 * 1e6 / 100,
      96.8166 * 1e6 / 100,
      97.9226 * 1e6 / 100,
      98.9825 * 1e6 / 100,
      100 * 1e6 / 100
      ];
  
      vm.roll(blockNo);
      blockNo = blockNo > 26? 26 : blockNo;
      uint256 calcWeather = blockNo == 1 ? ScaleValues[blockNo - 1] : ScaleValues[blockNo - 1] * season.maxYield(); // weather is always 1% if sown at same block as sunrise, irregardless of weather
      assertApproxEqRel(field.getMorningYield(),calcWeather,0.00001*1e18);
    }
  
  // above peg testing
  function testPeas() public {
    _beforeEachMorningAuction();
    // sow 25% at delta 5
    uint256 i = 1;
    uint256 TotalSoilSown = 0; 
    console.log("Starting Soil:",field.totalSoil());
    while(field.totalSoil() > 1 * 1e6){
      vm.roll(i);
      console.log("rolling to block",i,",the delta is", i-1);
      uint256 LastTotalSoil = field.totalSoil();
      uint256 LastTrueSoil = field.totalTrueSoil();
      vm.prank(brean);
      uint256 AmtPodsGained = field.sowWithMin(5 * 1e6, 1 * 1e6, 5 * 1e6, LibTransfer.From.EXTERNAL);
      TotalSoilSown = TotalSoilSown + 5 * 1e6;
      console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
      console.log("TrueSoil Consumed:", LastTrueSoil - field.totalTrueSoil()); 
      console.log("pods gained:",AmtPodsGained);
      console.log("total pods:",field.totalPods());
      console.log("Soil Left:",field.totalSoil());
      if(i > 26){
        assertEq(field.totalSoil(),field.totalTrueSoil());
      }else{
        assertGt(field.totalSoil(),field.totalTrueSoil());
      }
      i++;
    }
    vm.roll(i + 2);
    console.log("rolling to block",i+2,",the delta is", i+1);

    uint256 LastTotalSoil = field.totalSoil();
    uint256 LastTrueSoil = field.totalTrueSoil();
    //dude im going crazy, why does field.totalSoil() not work but putting it as an input works??
    if(LastTotalSoil != 0){
      vm.prank(brean);
      uint256 AmtPodsGained = field.sowWithMin(LastTotalSoil, 1 * 1e6, LastTotalSoil, LibTransfer.From.EXTERNAL);
      TotalSoilSown = TotalSoilSown + LastTotalSoil;
      console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
      console.log("TrueSoil Consumed:", LastTrueSoil - field.totalTrueSoil());
      console.log("pods gained:",AmtPodsGained);
      console.log("total pods:",field.totalPods());
      console.log("Soil Left:",field.totalSoil());
    }

    assertApproxEqRel(field.totalMaxPeas(),field.totalUnharvestable(),0.0000001*1e18); //.00001% accuracy
    assertGt(TotalSoilSown,100 * 1e6); // check the amt of soil sown at the end of the season is greater than the start soil

  }
  
  // check that the Soil decreases over 25 blocks, then stays stagent
  function testSoilDecrementsOverDutch() public {
    _beforeEachMorningAuction();
    for(uint i = 1; i < 30; ++i){
      vm.roll(i);
      uint256 LastSoil = field.totalSoil();
      uint256 TrueSoil = field.totalTrueSoil();
    
      if(i > 25) { //note the block saved on s.f.sunrise block is 1, so the delta is 25 at blockNo 26
        assertEq(LastSoil,TrueSoil);
      }
      else{
        assertGt(LastSoil,TrueSoil);
      }
    }
  }

  function testSowAllMorningAuction() public {
    _beforeEachMorningAuction();
    uint256 TotalSoil = field.totalSoil();
    vm.prank(brean);
    field.sowWithMin(TotalSoil, 1 * 1e6, TotalSoil, LibTransfer.From.EXTERNAL);
    assertEq(field.totalSoil(),0);
    assertApproxEqRel(field.totalUnharvestable(), 200 * 1e6,0.0000001*1e18); //.00001% accuracy
  }

  function _beforeEachMorningAuction() public {
    season.setYieldE(100);
    season.setStartSoilE(100*1e6);
    field.incrementTotalSoilE(100 * 1e6);
    season.setAbovePegE(true);
  }
}
