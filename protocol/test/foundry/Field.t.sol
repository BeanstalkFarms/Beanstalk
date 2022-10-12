// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { FieldFacet } from "farm/facets/FieldFacet.sol";
import "./utils/InitDiamondDeployer.sol";
import "./utils/LibConstant.sol";
import "libraries/LibPRBMath.sol";

contract FieldTest is FieldFacet, Test, InitDiamondDeployer {
  using SafeMath for uint256;
  using LibPRBMath for uint256;
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
    assertEq(uint256(field.totalSoil()), 0);
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
    assertEq(uint256(field.totalSoil()), 100 * 1e6);
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
    assertEq(uint256(field.totalSoil()), 100 * 1e6);
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
    assertEq(uint256(field.totalSoil()), 150 * 1e6);
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
    assertEq(uint256(field.totalSoil()), 0* 1e6);
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
    assertEq(uint256(field.totalSoil()), 100* 1e6);
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
    assertEq(uint256(field.totalSoil()), 0* 1e6);
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
    assertEq(uint256(field.totalSoil()), 0 * 1e6);
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
    assertEq(uint256(field.totalSoil()), 0 * 1e6);
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
    assertEq(uint256(field.totalSoil()), 0 * 1e6);
    assertEq(field.totalUnharvestable(), 101 * 1e6);
    assertEq(field.totalHarvestable(), 0 * 1e6);
    assertEq(field.harvestableIndex(), 101 * 1e6);
    assertEq(field.totalHarvested(), 101 * 1e6);
    assertEq(field.podIndex(), 202 * 1e6);

    //deletes
    assertEq(marketplace.podListing(0), 0);
  }

  // Morning Auction
  function testMorningAuctionValues(uint256 blockNo,uint32 __weather) public {
    // tests that morning auction values align with manually calculated values
    uint256 _weather = bound(__weather,1,69420); // arbitary large number
    season.setYieldE(uint32(_weather));
    blockNo = bound(blockNo,1,26); // 12s block time = 300 blocks in an season
    uint256[26] memory ScaleValues;
    ScaleValues = [
      uint256(1000000000000000000), //Delta = 0
      27941531270472219644, // Delta = 1
      40933603439553744066, // 2
      49491262604822332450, // 3
      55883062540944439288, // 4
      60986816221982127737, // 5
      65235582578068370432, // 6
      68875134710025963710, // 7
      72058468729527780355, // 8 
      74887323452496691911, // 9
      77432793875294552094, // 10
      79746522578026803905, // 11
      81867206879107488133, // 12
      83824593811416658932, // 13
      85642043786496853293, // 14
      87338237380220956962, // 15
      88928347492454347382, // 16
      90424866044376076517, // 17
      91838200620871701185, // 18
      93177113848540590076, // 19
      94449052770715264861, // 20
      95660399698026829873, // 21
      96816665980498183355, // 22
      97922643610274415212, // 23
      98982525209644664900, // 24
      100000000000000000000
    ];
    ScaleValues = [
      uint256(100000000000000000), //Delta = 0
      2794153127047221964, // Delta = 1
      4093360343955374406, // 2
      4949126260482233245, // 3
      5588306254094443928, // 4
      6098681622198212773, // 5
      6523558257806837043, // 6
      6887513471002596371, // 7
      7205846872952778035, // 8 
      7488732345249669191, // 9
      7743279387529455209, // 10
      7974652257802680390, // 11
      8186720687910748813, // 12
      8382459381141665893, // 13
      8564204378649685329, // 14
      8733823738022095696, // 15
      8892834749245434738, // 16
      9042486604437607651, // 17
      9183820062087170118, // 18
      9317711384854059007, // 19
      9444905277071526486, // 20
      9566039969802682987, // 21
      9681666598049818335, // 22
      9792264361027441521, // 23
      9898252520964466490, // 24
      10000000000000000000
    ];
  
    vm.roll(blockNo);
    _weather = uint256(season.maxYield()).mulDiv(ScaleValues[blockNo - 1],1e13);
    uint256 calcWeather = blockNo == 1 ? 1e6 : max(_weather,1 * 1e6); // weather is always 1% if sown at same block as sunrise, irregardless of weather
    assertApproxEqRel(field.yield(),calcWeather,0.00001*1e18);
    //assertEq(field.yield(),calcWeather);
  }
  
  // Various sowing at differnt dutch auctions
  function testPeas() public {
    _beforeEachMorningAuction();
    uint256 _block = 1;
    uint256 TotalSoilSown = 0; 
    uint256 maxAmount = 10 * 1e6;
    while(field.totalSoil() > maxAmount){
      uint256 amount = uint256(keccak256(abi.encodePacked(_block))).mod(maxAmount);
      vm.roll(_block);
      console.log("rolling to block",_block);
      uint256 LastTotalSoil = field.totalSoil();
      uint256 BreanBal = C.bean().balanceOf(brean);
      uint256 LastTrueSoil = field.totalTrueSoil();
      vm.prank(brean);
      uint256 AmtPodsGained = field.sowWithMin(amount, 1 * 1e6, amount, LibTransfer.From.EXTERNAL);
      TotalSoilSown = TotalSoilSown + amount;
      assertApproxEqAbs(LastTotalSoil - field.totalSoil(), amount, 1);
      // console.log("Current Yield:", field.yield());
      // console.log("TotalSoil Start of Block:",LastTotalSoil);
      // console.log("TotalSoil End of Block:",field.totalSoil());
      // console.log("TrueSoil Start of Block:",LastTrueSoil);
      // console.log("TrueSoil End of Block:",field.totalTrueSoil());
      // console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
      // console.log("TrueSoil Consumed:", LastTrueSoil - field.totalTrueSoil()); 
      // console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
      // console.log("pods gained:",AmtPodsGained);
      // console.log("total pods:",field.totalPods());
      _block++;
    }
    vm.roll(50);
    uint256 soilLeft = field.totalSoil();
    vm.prank(brean);
    field.sowWithMin(soilLeft, 1 * 1e6, soilLeft, LibTransfer.From.EXTERNAL);
    TotalSoilSown = TotalSoilSown + soilLeft;
    assertApproxEqRel(field.maxPeas(),field.totalUnharvestable(),0.000001*1e18); //.0001% accuracy
    assertGt(TotalSoilSown,100 * 1e6); // check the amt of soil sown at the end of the season is greater than the start soil

  }
 
  function _testRoundingError() public {
     _beforeEachMorningAuction();
    uint256 _block = 1;
    uint256 TotalSoilSown = 0; 
    uint256 amount = 5 * 1e6;
    while(field.totalSoil() > 5 * 1e6){
    vm.roll(_block);
    console.log("rolling to block",_block,",the delta is", _block - 1);
    uint256 LastTotalSoil = field.totalSoil();
    uint256 BreanBal = C.bean().balanceOf(brean);
    uint256 LastTrueSoil = field.totalTrueSoil();
    uint256 AmtPodsGained = 0;
    vm.prank(brean);
    AmtPodsGained = field.sowWithMin(amount, 1 * 1e6, amount, LibTransfer.From.EXTERNAL);
    TotalSoilSown = TotalSoilSown + amount;
    assertEq(LastTotalSoil - field.totalSoil(), amount, "Error: soil sown doesn't equal soil used.");
    console.log("Current Yield:", field.yield());
    console.log("TotalSoil Start of Block:",LastTotalSoil);
    console.log("TotalSoil End of Block:",field.totalSoil());
    console.log("TrueSoil Start of Block:",LastTrueSoil);
    console.log("TrueSoil End of Block:",field.totalTrueSoil());
    console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
    console.log("TrueSoil Consumed:", LastTrueSoil - field.totalTrueSoil()); 
    console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
    console.log("pods gained:",AmtPodsGained);
    console.log("total pods:",field.totalPods());
    _block++;
    }
    uint256 soilLeft = field.totalSoil();
    vm.prank(brean);
    field.sowWithMin(soilLeft, 1 * 1e6, soilLeft, LibTransfer.From.EXTERNAL);
    TotalSoilSown = TotalSoilSown + 1e6;
    assertEq(field.maxPeas(),field.totalUnharvestable(), "Error: TotalUnharvestable doesn't equal maxPeas."); //.0001% accuracy
    assertGt(TotalSoilSown,100 * 1e6, "Error: Total soil sown is less than inital soil issued."); // check the amt of soil sown at the end of the season is greater than the start soil
    
  }
  // check that the Soil decreases over 25 blocks, then stays stagent
  function testSoilDecrementsOverDutch() public {
    _beforeEachMorningAuction();
    for(uint i = 1; i < 30; ++i){
      vm.roll(i);
      uint256 LastSoil = uint256(field.totalSoil());
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
    uint256 TotalSoil = uint256(field.totalSoil());
    vm.prank(brean);
    field.sowWithMin(TotalSoil, 1 * 1e6, TotalSoil, LibTransfer.From.EXTERNAL);
    assertEq(uint256(field.totalSoil()),0);
    assertApproxEqRel(field.totalUnharvestable(), 200 * 1e6,0.0000001*1e18); //.00001% accuracy
  }

  // BeforeEach Helpers
  function _beforeEachMorningAuction() public {
    season.setYieldE(100);
    season.setStartSoilE(100*1e6);
    field.incrementTotalSoilE(100 * 1e6);
    season.setAbovePegE(true);
  }

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

  // Test Helpers
  function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

  
}
