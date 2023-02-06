// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import { FieldFacet } from "~/beanstalk/field/FieldFacet.sol";
import "test/foundry/utils/LibConstant.sol";
import "~/libraries/LibPRBMath.sol";
import "./utils/TestHelper.sol";

contract FieldTest is FieldFacet, TestHelper {
  using SafeMath for uint256;
  using LibPRBMath for uint256;
  using LibSafeMath32 for uint32;
  using Decimal for Decimal.D256;

  Storage.Weather weather;
  Storage.Weather weather2;
  
  constructor() {
    setupDiamond();
    season.lightSunrise();
  }

  function setUp() public {
    vm.prank(brean);
    C.bean().approve(address(field),(2 ** 256 -1));
    vm.prank(siloChad);
    C.bean().approve(address(field),(2 ** 256 -1));
    C.bean().mint(brean, 1e18);
    C.bean().mint(siloChad, 1e18);
  }

  // user should not be able to sow if there is no soil. 
  function testCannotSowWithNoSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Soil Slippage");
    field.sow(1,1e6,LibTransfer.From.EXTERNAL);
  }

  // user should not sow if the amount input is less than the minSoil
  function testCannotSowBelowMinSoil() public {
    vm.prank(brean);
    vm.expectRevert("Field: Soil Slippage");
    field.sowWithMin(1,1e6,3,LibTransfer.From.EXTERNAL);

  }

  // test checks field status after sowing 100 soil, with 100 available soil.
  function testSowAllSoil() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();
    
    _beforeEachSow();
    console.log("Updates user's balance:");
    assertEq(C.bean().balanceOf(brean),beanBalanceBefore - 100e6, "balanceOf");
    assertEq(field.plot(brean,0), 101e6, "plot");
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0,"field balanceOf");
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6, "total supply");
    assertEq(field.totalPods(), 101e6, "total Pods");
    assertEq(uint256(field.totalSoil()), 0, "total Soil");
    assertEq(uint256(field.totalRealSoil()), 0, "true Soil");
    assertEq(field.totalUnharvestable(), 101e6, "totalUnharvestable");
    assertEq(field.podIndex(), 101e6, "podIndex");
    assertEq(field.harvestableIndex(), 0, "harvestableIndex");
  }

  //  test checks field status after sowing 50 soil, with 100 available soil.
  function testSowSomeSoil() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachSomeSow();

    vm.prank(brean);
    console.log("Updates user's balance:");
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 100e6);
    assertEq(field.plot(brean,0), 101e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6);
    assertEq(field.totalPods(), 101e6);
    assertEq(uint256(field.totalSoil()), 100e6);
    assertEq(field.totalUnharvestable(), 101e6);
    assertEq(field.podIndex(), 101e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // sow soil from internal balances
  function testSowSomeSoilFromInternal() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachSomeSowFromInternal();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 100e6);
    assertEq(field.plot(brean,0), 101e6);
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6);
    assertEq(field.totalPods(), 101e6);
    assertEq(uint256(field.totalSoil()), 100e6);
    assertEq(field.totalUnharvestable(), 101e6);
    assertEq(field.podIndex(), 101e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // sow soil from internal tolerant mode
  function testSowSomeSoilFromInternalTolerant() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachSomeSowFromInternalTolerant();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 50e6);
    assertEq(field.plot(brean, 0), 50.5e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 50e6);
    assertEq(field.totalPods(), 50.5e6);
    assertEq(uint256(field.totalSoil()), 150e6);
    assertEq(field.totalUnharvestable(), 50.5e6);
    assertEq(field.podIndex(), 50.5e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // sowing with min
  function testSowMin() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachSowMin();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 100e6);
    assertEq(field.plot(brean,0), 101e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6);
    assertEq(field.totalPods(), 101e6);
    assertEq(uint256(field.totalSoil()), 0);
    assertEq(field.totalUnharvestable(), 101e6);
    assertEq(field.podIndex(), 101e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // sow min w/enough soil
  function testSowMinWithEnoughSoil() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachSowMinWithEnoughSoil();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 100e6);
    assertEq(field.plot(brean,0), 101e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6);
    assertEq(field.totalPods(), 101e6);
    assertEq(uint256(field.totalSoil()), 100e6);
    assertEq(field.totalUnharvestable(), 101e6);
    assertEq(field.podIndex(), 101e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // sowing from 2 users
  function testSowFrom2Users() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 beanBalanceBefore2 = C.bean().balanceOf(siloChad);

    uint256 totalBeanSupplyBefore = C.bean().totalSupply();
    
    _beforeEachSow2Users();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 100e6);
    assertEq(C.bean().balanceOf(siloChad), beanBalanceBefore2 - 100e6);

    assertEq(field.plot(brean,0), 101e6);
    assertEq(field.plot(siloChad, 101e6), 101e6);

    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 200e6);
    assertEq(field.totalPods(), 202e6);
    assertEq(uint256(field.totalSoil()), 0);
    assertEq(field.totalUnharvestable(), 202e6);
    assertEq(field.podIndex(), 202e6);
    assertEq(field.harvestableIndex(), 0);
  }

  // checking next sow time
  function testComplexDPDMoreThan1Soil() public {
    // Does not set thisSowTime if Soil > 1;
    season.setSoilE(3e6);
    vm.prank(brean);
    field.sow(1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertEq(uint256(weather.thisSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPD1Soil() public {
    // Does set thisSowTime if Soil = 1;
    season.setSoilE(1e6);
    vm.prank(brean);
    field.sow(1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.thisSowTime), uint256(LibConstant.MAX_UINT32));
  }

  function testComplexDPDLessThan1Soil() public {
    // Does set thisSowTime if Soil < 1;
    season.setSoilE(1.5e6);
    vm.prank(brean);
    field.sow(1*1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    assertLt(uint256(weather.thisSowTime), uint256(LibConstant.MAX_UINT32));
  
  }

  function testComplexDPDLessThan1SoilNoSetterino() public {
    // Does not set thisSowTime if Soil already < 1;
    season.setSoilE(1.5e6);
    vm.prank(brean);
    field.sow(1e6,1,LibTransfer.From.EXTERNAL);
    weather = season.weather();
    vm.prank(siloChad);
    field.sow(0.5e6,1,LibTransfer.From.EXTERNAL);
    weather2 = season.weather();
    assertEq(uint256(weather2.thisSowTime), uint256(weather.thisSowTime));

  }

  // reverts if the usser does not own the flot
  function testCannotHarvestUnownedPlot() public {
    _beforeEachHarvest();
    field.incrementTotalHarvestableE(101e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(siloChad);
    vm.expectRevert("Field: no plot");
    field.harvest(harvestPlot,LibTransfer.To.EXTERNAL);
  }

  // reverts if the plot is unharvestable
  function testCannotHarvestUnharvestablePlot() public {
    _beforeEachHarvest();
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectRevert("Field: Plot not Harvestable");
    field.harvest(harvestPlot,LibTransfer.To.EXTERNAL);
  }

  // entire plot
  function testHarvestEntirePlot() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachHarvest();
    _beforeEachFullHarvest();
    //updates user balance
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore + 1e6);
    assertEq(field.plot(brean, 0),0);

    //updates total balance
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6 + 1e6);
    assertEq(field.totalPods(), 101e6);
    assertEq(uint256(field.totalSoil()), 0);
    assertEq(field.totalUnharvestable(), 101e6);
    assertEq(field.totalHarvestable(), 0);
    assertEq(field.harvestableIndex(), 101e6);
    assertEq(field.totalHarvested(), 101e6);
    assertEq(field.podIndex(), 202e6);

  }

  // partial plot
  function testHarvestPartialPlot() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();

    _beforeEachHarvest();
    _beforeEachPartialHarvest();
    //updates user balance
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore - 50e6);
    assertEq(field.plot(brean, 0),0);
    assertEq(field.plot(brean, 50e6), 51e6);

    //updates total balance
    console.log("Updates total balance:");
    assertEq(C.bean().balanceOf(address(field)),0);
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 200e6 + 50e6);
    assertEq(field.totalPods(), 152e6);
    assertEq(uint256(field.totalSoil()), 0);
    assertEq(field.totalUnharvestable(), 152e6);
    assertEq(field.totalHarvestable(), 0);
    assertEq(field.harvestableIndex(), 50e6);
    assertEq(field.totalHarvested(), 50e6);
    assertEq(field.podIndex(), 202e6);
  }
  
  // harvest with plot listing (removes listing)
  function testHarvestEntirePlotWithListing() public {
    uint256 beanBalanceBefore = C.bean().balanceOf(brean);
    uint256 totalBeanSupplyBefore = C.bean().totalSupply();
    
    _beforeEachHarvest();
    _beforeEachHarvestEntirePlotWithListing();
    assertEq(C.bean().balanceOf(brean), beanBalanceBefore + 1e6);
    assertEq(field.plot(brean, 0),0);
    assertEq(C.bean().balanceOf(address(field)),0, "Field balanceOf");
    assertEq(C.bean().totalSupply(), totalBeanSupplyBefore - 100e6 + 1e6, "totalSupply");

    assertEq(field.totalPods(), 101e6, "totalPods");
    assertEq(uint256(field.totalSoil()), 0, "soil");
    assertEq(field.totalUnharvestable(), 101e6, "totalUnharvestable");
    assertEq(field.totalHarvestable(), 0, "totalHarvestable");
    assertEq(field.harvestableIndex(), 101e6, "harvestableIndex");
    assertEq(field.totalHarvested(), 101e6, "totalHarvested");
    assertEq(field.podIndex(), 202 * 1e6,"podIndex");

    //deletes
    assertEq(marketplace.podListing(0), 0);
  }

  // Morning Auction
  function testMorningAuctionValues(uint256 blockNo, uint32 _weather) public {
    // tests that morning auction values align with manually calculated values
    _weather = uint32(bound(_weather, 1, 69420)); // arbitary large number
    season.setMaxTempE(_weather);
    blockNo = bound(blockNo,1,26); // 12s block time = 300 blocks in an season
    
    uint256[26] memory ScaleValues;
    ScaleValues = [
      uint256(1000000), //Delta = 0
      279415312704, // Delta = 1
      409336034395, // 2
      494912626048, // 3
      558830625409, // 4
      609868162219, // 5
      652355825780, // 6
      688751347100, // 7
      720584687295, // 8 
      748873234524, // 9
      774327938752, // 10
      797465225780, // 11
      818672068791, // 12
      838245938114, // 13
      856420437864, // 14
      873382373802, // 15
      889283474924, // 16
      904248660443, // 17
      918382006208, // 18
      931771138485, // 19
      944490527707, // 20
      956603996980, // 21
      968166659804, // 22
      979226436102, // 23
      989825252096, // 24
      1000000000000
    ];
  
    vm.roll(blockNo);
    uint256 __weather = uint256(
      season.weather().t
    ).mulDiv(
        ScaleValues[blockNo - 1],
        1e6,
        LibPRBMath.Rounding.Up
      );
    // weather is always 1% if sown at same block as sunrise, irregardless of weather
    uint256 calcWeather = blockNo == 1 ? 1e6 : max(__weather,1e6); 
    assertApproxEqAbs(field.temperature(),calcWeather, 0); // +/- 1 due to rounding
  }
  
  // various sowing at different dutch auctions + different soil amount
  // @FIXME: way to fuzz test this while keeping state?
  // soil sown should be larger than starting soil
  // pods issued should be the same maximum
  function test_remainingPods_abovePeg() public {
    _beforeEachMorningAuction();
    uint256 _block = 1;
    uint256 totalSoilSown = 0;
    uint256 TotalSownTransactions = 0; 
    uint256 maxAmount = 10 * 1e6;
    uint256 totalPodsMinted = 0;
    uint256 LastTotalSoil;
    uint256 BreanBal;
    uint256 LastTrueSoil;
    uint256 AmtPodsGained;
    console.log("Initial remainingPods:",field.remainingPods());

    vm.startPrank(brean);
    while(field.totalSoil() > maxAmount){
      // pseudo-random numbers to sow
      uint256 amount = uint256(
        keccak256(abi.encodePacked(_block))
        ).mod(maxAmount); 
      vm.roll(_block);
      console.log("------rolling to block",_block,"------");
      LastTotalSoil = field.totalSoil();
      BreanBal = C.bean().balanceOf(brean);
      LastTrueSoil = field.totalRealSoil();
      AmtPodsGained = field.sowWithMin(
        amount, 
        1e6, 
        amount, 
        LibTransfer.From.EXTERNAL
      );
      totalSoilSown = totalSoilSown + amount;
      totalPodsMinted = totalPodsMinted + AmtPodsGained;
      // assertApproxEqAbs(LastTotalSoil - field.totalSoil(), amount, 1); // rounding error
      console.log("Current Temperature:", field.yield());
      console.log("Max Temperature:", season.weather().t);
      console.log("TotalSoil Start of Block:",LastTotalSoil);
      console.log("TotalSoil End of Block:",field.totalSoil());
      console.log("TrueSoil Start of Block:",LastTrueSoil);
      console.log("TrueSoil End of Block:",field.totalRealSoil());
      console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
      console.log("TrueSoil Consumed:", LastTrueSoil - field.totalRealSoil()); 
      console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
      console.log("pods gained:",AmtPodsGained);
      console.log("remaining pods:",field.remainingPods());
      console.log("total pods:",field.totalPods());
        console.log("total effective pods:", field.remainingPods() + field.totalPods());

      _block++;
      TotalSownTransactions++;
    }
    vm.roll(30);
    console.log("------rolling to block", 30 ,"------");
    uint256 soilLeft = field.totalSoil();
    LastTotalSoil = field.totalSoil();
    BreanBal = C.bean().balanceOf(brean);
    LastTrueSoil = field.totalRealSoil();
    AmtPodsGained = field.sow(
      soilLeft, 
      1e6,
      LibTransfer.From.EXTERNAL
    );
    totalSoilSown = totalSoilSown + soilLeft;
    totalPodsMinted = totalPodsMinted + AmtPodsGained;
    console.log("Current Yield:", field.yield());
    console.log("TotalSoil Start of Block:",LastTotalSoil);
    console.log("TotalSoil End of Block:",field.totalSoil());
    console.log("TrueSoil Start of Block:",LastTrueSoil);
    console.log("TrueSoil End of Block:",field.totalRealSoil());
    console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
    console.log("TrueSoil Consumed:", LastTrueSoil - field.totalRealSoil()); 
    console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
    console.log("pods gained:",AmtPodsGained);
    console.log("total pods:",field.totalPods());
    assertEq(field.totalPods(),field.totalUnharvestable(),"totalUnharvestable");
    assertEq(totalPodsMinted,field.totalPods(),"totalPodsMinted");
    assertEq(field.remainingPods(),0, "remainingPods");
    assertGt(totalSoilSown,100e6,"totalSoilSown"); // check the amt of soil sown at the end of the season is greater than the start soil 
    vm.stopPrank();
  }

  // same test as above, but below peg
  // soil sown should be equal to starting soil
  // pods issued should be less than maximum
  function test_remainingPods_belowPeg() public prank(brean) {
    _beforeEachMorningAuctionBelowPeg();
    uint256 _block = 1;
    uint256 totalSoilSown = 0;
    uint256 TotalSownTransactions = 0; 
    uint256 maxAmount = 5 * 1e6;
    uint256 totalPodsMinted = 0;
    uint256 LastTotalSoil;
    uint256 BreanBal;
    uint256 AmtPodsGained;
    uint256 maxPods = 200e6;
    uint256 initalBreanBal = C.bean().balanceOf(brean);

    while(field.totalSoil() > maxAmount){
      // pseudo-random numbers to sow
      uint256 amount = uint256(keccak256(abi.encodePacked(_block))).mod(maxAmount); 
      vm.roll(_block);
      console.log("------rolling to block",_block,"------");
      LastTotalSoil = field.totalSoil();
      BreanBal = C.bean().balanceOf(brean);
      AmtPodsGained = field.sow(
        amount, 
        1e6,
        LibTransfer.From.EXTERNAL
      );
      totalSoilSown = totalSoilSown + amount; 
      totalPodsMinted = totalPodsMinted + AmtPodsGained;
      assertEq(LastTotalSoil - field.totalSoil(), amount); // rounding error
      console.log("Current Yield:", field.yield());
      console.log("TotalSoil Start of Block:",LastTotalSoil);
      console.log("TotalSoil End of Block:",field.totalSoil());
      console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil()); 
      console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
      console.log("pods gained:",AmtPodsGained);
      console.log("remainingPods:",field.remainingPods());
      console.log("total pods:",field.totalPods());
      _block++;
      TotalSownTransactions++;
    }
    vm.roll(30);
    console.log("------rolling to block",_block,"------");
    uint256 soilLeft = field.totalSoil();
    LastTotalSoil = field.totalSoil();
    BreanBal = C.bean().balanceOf(brean);
    AmtPodsGained = field.sowWithMin(
      soilLeft, 
      1e6, 
      0, 
      LibTransfer.From.EXTERNAL
    );
    totalSoilSown = totalSoilSown + soilLeft;
    totalPodsMinted = totalPodsMinted + AmtPodsGained;
    console.log("Current Yield:", field.yield());
    console.log("TotalSoil Start of Block:",LastTotalSoil);
    console.log("TotalSoil End of Block:",field.totalSoil());
    console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
    console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
    console.log("pods gained:",AmtPodsGained);
    console.log("total pods:",field.totalPods());
    console.log("total sow transactions:",TotalSownTransactions);
    console.log("total soil used:",totalSoilSown);
    console.log("net pod reduction:",maxPods - field.totalPods());

    assertLt(field.totalUnharvestable(), maxPods);
    assertEq(field.totalPods(),field.totalUnharvestable() , "totalUnharvestable");
    assertEq(totalPodsMinted,field.totalPods() , "totalPodsMinted");
    assertEq(field.remainingPods() , 0, "remainingPods is not 0");
    assertEq(totalSoilSown, 100e6, "totalSoilSown"); // check the amt of soil sown at the end of the season is equal to start soil 
    assertEq(totalSoilSown, initalBreanBal - C.bean().balanceOf(brean), "total bean used does not equal total soil sown");
  }
 
  // multiple fixed amount sows at different dutch auction times
  function testRoundingError() public {
     _beforeEachMorningAuction();
    uint256 _block = 1;
    uint256 totalSoilSown = 0; 
    uint256 amount = 5e6;
    uint256 totalPodsMinted = 0;
    uint256 LastTotalSoil;
    uint256 BreanBal;
    uint256 LastTrueSoil;
    uint256 AmtPodsGained;
    while(field.totalSoil() > 5e6 && _block < 25 ){
    vm.roll(_block);
    console.log("rolling to block",_block,",the delta is", _block - 1);
    LastTotalSoil = field.totalSoil();
    BreanBal = C.bean().balanceOf(brean);
    LastTrueSoil = field.totalRealSoil();
    AmtPodsGained = 0;
    vm.prank(brean);
    AmtPodsGained = field.sowWithMin(amount, 1e6, amount, LibTransfer.From.EXTERNAL);
    totalSoilSown = totalSoilSown + amount;
    totalPodsMinted = totalPodsMinted + AmtPodsGained;
    /// @dev due to rounding precision as totalsoil is scaled up,
    ///  and does not represent the amount of soil removed
    assertApproxEqAbs(LastTotalSoil - field.totalSoil(), amount, 1);
    console.log("Current Yield:", field.yield());
    console.log("TotalSoil Start of Block:",LastTotalSoil);
    console.log("TotalSoil End of Block:",field.totalSoil());
    console.log("TrueSoil Start of Block:",LastTrueSoil);
    console.log("TrueSoil End of Block:",field.totalRealSoil());
    console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
    console.log("TrueSoil Consumed:", LastTrueSoil - field.totalRealSoil()); 
    console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
    console.log("pods gained:",AmtPodsGained);
    console.log("total pods:",field.totalPods());
    _block++;
    }
    LastTotalSoil = field.totalSoil();
    BreanBal = C.bean().balanceOf(brean);
    LastTrueSoil = field.totalRealSoil();
    uint256 soilLeft = field.totalSoil();

    vm.prank(brean);
    AmtPodsGained = field.sowWithMin(soilLeft, 1e6, soilLeft, LibTransfer.From.EXTERNAL);
    totalSoilSown = totalSoilSown + soilLeft;
    totalPodsMinted = totalPodsMinted + AmtPodsGained;
    assertEq(soilLeft,LastTotalSoil - field.totalSoil(), "soil sown doesn't equal soil used.");
    console.log("Current Yield:", field.yield());
    console.log("TotalSoil Start of Block:",LastTotalSoil);
    console.log("TotalSoil End of Block:",field.totalSoil());
    console.log("TrueSoil Start of Block:",LastTrueSoil);
    console.log("TrueSoil End of Block:",field.totalRealSoil());
    console.log("TotalSoil Consumed:",LastTotalSoil - field.totalSoil());
    console.log("TrueSoil Consumed:", LastTrueSoil - field.totalRealSoil()); 
    console.log("Beans Burnt:",BreanBal - C.bean().balanceOf(brean));
    console.log("pods gained:",AmtPodsGained);
    console.log("total pods:",field.totalPods());
    assertEq(field.totalUnharvestable(),totalPodsMinted, "TotalUnharvestable doesn't equal totalPodsMinted"); //.0001% accuracy
    assertGt(totalSoilSown,100e6, "Total soil sown is less than inital soil issued."); // check the amt of soil sown at the end of the season is greater than the start soil
  }

  // check that the Soil decreases over 25 blocks, then stays stagent
  // when beanstalk is above peg, the soil issued is now: 
  // soil = s.f.soil * (1+ s.w.t)/(1+ yield())
  // soil should always be greater/ equal to s.f.soil
  function testSoilDecrementsOverDutchAbovePeg() public {
    _beforeEachMorningAuction();
    uint256 startingSoil = 100e6;
    startingSoil = startingSoil.mulDiv(200,101);
    uint256 sfsoil = uint256(field.totalRealSoil());
    for(uint i = 1; i < 30; ++i){
      vm.roll(i);
      uint256 LastSoil = uint256(field.totalSoil());
      if (i == 1) { // sunriseBlock is set at block 1;
        assertEq(LastSoil,startingSoil,"LastSoil");
      } else if (i < 27){
        console.log("delta:", i);
        assertGt(startingSoil,LastSoil);
        assertGt(startingSoil,sfsoil);
        startingSoil = LastSoil;
      } else {
        console.log("delta:", i);
        assertEq(startingSoil,LastSoil);
        assertEq(startingSoil,sfsoil);
        startingSoil = LastSoil;
      }
    }
  }
  // sowing all with variable soil, weather, and delta
  // pods issued should always be equal to remainingPods
  // soil/bean used should always be greater/equal to soil issued. 
  function testSowAllMorningAuctionAbovePeg(uint256 soil,uint32 _weather,uint256 delta) public {
    soil = bound(soil,1e6,100e6);
    _weather = uint32(bound(_weather,1,69420));
    delta = bound(delta,1,301); //maximum blockdelta within a season is 300 blocks  
    season.setMaxTempE(_weather);
    season.setSoilE(soil);
    season.setAbovePegE(true);
    vm.roll(delta);
    uint256 remainingPods = field.remainingPods();
    uint256 TotalSoil = field.totalSoil();
    vm.prank(brean);
    field.sowWithMin(
      TotalSoil,
      1e6,
      TotalSoil,
      LibTransfer.From.EXTERNAL
      );
    assertEq(uint256(field.totalSoil()), 0, "totalSoil greater than 0");
    assertEq(uint256(field.totalRealSoil()), 0, "s.f.soil greater than 0");
    assertEq(field.totalUnharvestable(), remainingPods, "Unharvestable pods does not Equal Expected.");
  }

  // sowing all with variable soil, weather, and delta
  // pods issued should always be lower than remainingPods
  // soil/bean used should always be equal to soil issued. 
  function testSowAllMorningAuctionBelowPeg(uint256 soil,uint32 _weather,uint256 delta) public {
    soil = bound(soil,1e6,100e6);
    _weather = uint32(bound(_weather,1,69420));
    delta = bound(delta,1,301); //maximum blockdelta within a season is 300 blocks  
    season.setMaxTempE(_weather);
    season.setSoilE(soil);
    season.setAbovePegE(false);
    vm.roll(delta);
    uint256 remainingPods = field.remainingPods();
    uint256 TotalSoil = field.totalSoil();
    vm.prank(brean);
    field.sow(
      TotalSoil,
      1e6,
      LibTransfer.From.EXTERNAL
      );
    assertEq(uint256(field.totalSoil()), 0, "totalSoil greater than 0");
    assertEq(field.totalUnharvestable(), remainingPods, "Unharvestable pods does not Equal Expected.");
  }
  // BeforeEach Helpers
  function _beforeEachMorningAuction() public {
    season.setMaxTempE(100);
    season.setSoilE(100e6);
    season.setAbovePegE(true);
  }

  function _beforeEachMorningAuctionBelowPeg() public {
    season.setMaxTempE(100);
    season.setSoilE(100e6);
    season.setAbovePegE(false);
  }

  function _beforeEachFullHarvest() public {
    field.incrementTotalHarvestableE(101e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot, 101* 1e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }

  function _beforeEachPartialHarvest() public {
    field.incrementTotalHarvestableE(50e6);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot, 50e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }

  function _beforeEachHarvest() public {
    season.setSoilE(200e6);
    vm.roll(30); // after morning Auction
    vm.prank(brean);
    field.sow(100e6,1,LibTransfer.From.EXTERNAL);
    vm.prank(siloChad);
    field.sow(100e6,1,LibTransfer.From.EXTERNAL);
  }

  function _beforeEachHarvestEntirePlotWithListing() public {
    field.incrementTotalHarvestableE(101e6);
    vm.prank(brean);
    marketplace.createPodListing(0, 0, 500, 500000, 200 * 1e6, 1 * 1e6, LibTransfer.To.EXTERNAL);
    uint256[] memory harvestPlot = new uint[](1);
    harvestPlot[0] = 0;
    vm.prank(brean);
    vm.expectEmit(true,true,false,true);
    // account, index, beans, pods
    emit Harvest(brean,harvestPlot,101e6);
    field.harvest(harvestPlot, LibTransfer.To.EXTERNAL);
  }

  function _beforeEachSow() prank(brean) public {
    vm.roll(30);
    season.setSoilE(100e6);
    console.log("b4 field.totalSoil():",field.totalSoil());

    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0, 100e6, 101e6);
    field.sow(100e6, 1e6,LibTransfer.From.EXTERNAL);
    console.log("after field.totalSoil():",field.totalSoil());
    console.log("after field.trueSoil():",field.totalRealSoil());
  }

  function _beforeEachSomeSow() public {
    season.setSoilE(200e6);
    vm.prank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean, 0, 100e6, 101e6);
    field.sow(100e6, 1e6, LibTransfer.From.EXTERNAL);
  }

  function _beforeEachSomeSowFromInternal() public {
    season.setSoilE(200e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 100e6, LibTransfer.From.EXTERNAL, LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean, 0, 100e6, 101e6);
    field.sow(100e6, 1e6, LibTransfer.From.INTERNAL);
    vm.stopPrank();
  }

  function _beforeEachSomeSowFromInternalTolerant() public {
    season.setSoilE(200e6);
    vm.startPrank(brean);
    token.transferToken(C.bean(),brean, 50e6, LibTransfer.From.EXTERNAL,LibTransfer.To.INTERNAL);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,50e6,50.5e6);
    field.sow(100e6, 1e6, LibTransfer.From.INTERNAL_TOLERANT);
    vm.stopPrank();
  }

  function _beforeEachSowMin() public {
    season.setSoilE(100e6);
    vm.roll(30);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean, 0, 100e6, 101e6);
    field.sowWithMin(200e6, 1e6, 100e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }

  function _beforeEachSowMinWithEnoughSoil() public {
    season.setSoilE(200e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean,0,100e6,101e6);
    field.sowWithMin(100e6, 1e6, 50e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }

  function _beforeEachSow2Users() public {
    season.setSoilE(200e6);
    vm.startPrank(brean);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(brean, 0, 100e6 ,101e6);
    field.sowWithMin(100e6, 1e6, 50e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();

    vm.startPrank(siloChad);
    vm.expectEmit(true,true,true,true);
    // account, index, beans, pods
    emit Sow(siloChad, 101e6, 100e6, 101e6);
    field.sowWithMin(100e6, 1e6, 50e6, LibTransfer.From.EXTERNAL);
    vm.stopPrank();
  }

  // Test Helpers
  function max(uint256 a, uint256 b) internal pure returns (uint256) {
    return a >= b ? a : b;
  }

  /// @dev when above peg,the amount of soil now issued is newHarvestable/1.01
  /// previously, the amount of soil issued was newHarvestable/(s.w.t + 1)
  /// this function replicates the previous behaviour with the new soil issuance when below peg.
  // above peg now does not do this anymore
  // function soilAbovePeg(uint256 a) internal view returns(uint256) {
  //   return a.mul(season.maxYield().add(100)).div(100); 
  // }

}
