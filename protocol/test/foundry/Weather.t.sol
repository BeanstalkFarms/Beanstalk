// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { Weather } from "~/beanstalk/facets/SeasonFacet/Weather.sol";
import "./utils/InitDiamondDeployer.sol";
import "./utils/LibConstant.sol";

contract ComplexWeatherTest is Weather, Test, InitDiamondDeployer {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;
  using Decimal for Decimal.D256;


  struct weatherData {
      uint256 unharvestablePods;
      uint256 totalOutstandingBeans;
      uint256 startingSoil;
      uint256 endingSoil;
      uint256 lastSoil;
      int256 priceAvg;
      uint32 startingWeather;
      uint32 lastSowTime;
      uint32 nextSowTime;
      bool wasRaining;
      uint256 rainingSeasons;
      uint256 rainStalk;
      uint32 newWeather;
      uint256 Code;
      bool postRain;
  }
  
  function setUp() public override{
    InitDiamondDeployer.setUp();
    console.log("Testing for complex weather:");

  }

  

  ///////////////////////// Utilities /////////////////////////
  //Complex Weather
  // then we have 11 cases to test
  function testComplexWeatherCases() public {
    weatherData[12] memory data;
    data = [
        weatherData(0,1,0,0,0,1,1,0,4294967295,true,1,1,1,4,false),
        weatherData(0,0,0,0,0,1,1,0,4294967295,true,1,1,1,24,false),
        weatherData(49,1000,0,0,0,-1,1,0,4294967295,true,1,1,4,0,false), // no work
        weatherData(51,1000,0,0,0,-1,1,0,4294967295,true,1,1,4,8,false), // no work
        weatherData(151,1000,1,0,0,-1,1,0,4294967295,true,1,1,2,18,false),
        weatherData(251,1000,1,0,1,-1,1,0,4294967295,false,1,1,4,25,false), // no work
        weatherData(0,1,0,0,0,1,100,0,4294967295,true,1,1,99,4,true), // no work 
        weatherData(0,1,0,0,0,100,1,0,4294967295,false,26,1,1,4,true),
        weatherData(151,1,0,0,0,-1,1,0,4294967295,false,26,1,4,24,false), // no work
        weatherData(251,1000,1,0,1,-1,1,4294967295,4294967295,true,1,1,4,25,false),
        weatherData(251,1000,1,0,1,0,1,0,0,true,1,1,2,26,false),
        weatherData(451,1000,1,0,1,0,1,0,0,true,1,1,2,26,false)
    ];
    vm.startPrank(brean);
    console.log("Testing for complex weather cases:");
      for(uint256 i = 0; i< data.length; ++i){
        season.setYieldE(data[i].startingWeather);

        C.bean().burn(C.bean().balanceOf(brean));
        uint256 lastDSoil = data[i].lastSoil;
        uint256 startSoil = data[i].startingSoil;
        uint256 endSoil = data[i].endingSoil;
        int256 deltaB = data[i].priceAvg;
        uint256 pods = data[i].unharvestablePods;
      
      
        bool raining = data[i].wasRaining;
        bool rainRoots = (data[i].rainStalk == 1)? true : false;

        C.bean().mint(brean,data[i].totalOutstandingBeans);
        
        season.setLastSowTimeE(data[i].lastSowTime);
        season.setNextSowTimeE(data[i].nextSowTime);
        season.stepWeatherWithParams(pods, lastDSoil, startSoil, endSoil, deltaB, raining, rainRoots);

        //check that the season weather is the same as the one specified in the array:
        assertEq(uint256(season.yield()), uint256(data[i].newWeather));
        // if(data[i].totalOutstandingBeans != 0){
          
        // }
        console.log("Case", i , "complete.");
        // TODO ADD EMIT EVENT TRACKING
    }
    vm.stopPrank();
  }
}

contract ExtremeWeatherTest is Weather, Test, InitDiamondDeployer {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;
  struct weatherData {
      uint256 unharvestablePods;
      uint256 totalOutstandingBeans;
      uint256 startingSoil;
      uint256 endingSoil;
      uint256 lastSoil;
      int256 priceAvg;
      uint32 startingWeather;
      uint32 lastSowTime;
      uint32 nextSowTime;
      bool wasRaining;
      uint256 rainingSeasons;
      uint256 rainStalk;
      uint32 newWeather;
      uint256 Code;
      bool postRain;
  }
  
  function setUp() public override{
    InitDiamondDeployer.setUp();
    _beforeExtremeWeatherTest();
    console.log("Testing for extreme weather:");
  }

  //Extreme weather
  function testExtremeNextSowTimeNow() public {
    console.log("NextSowTimeNow");
    _beforeEachExtremeWeatherTest();
    season.setLastSowTimeE(1);
    season.setNextSowTimeE(10);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),7);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 10);
  }

  function testExtremeLastSowTimeMax() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimeMax");
    season.setLastSowTimeE(LibConstant.MAX_UINT32);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),7);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTime61Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime61Delta");
    season.setLastSowTimeE(1061);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),7);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTime60Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime60Delta");
    season.setLastSowTimeE(1060);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),9);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeNeg60Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimeNeg60Delta");
    season.setLastSowTimeE(940);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),9);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeNeg100Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime100Delta");
    season.setLastSowTimeE(900);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),10);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeWtfDelta() public {
    console.log("This stupid test has conquered brean. the hardhat test equilivant works, but this does not. after stepWeatherE, this emits case 28, whereas the hardhat emits case 29. For the love of god someone help me");
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimewtfDelta");
    season.setLastSowTimeE(900);
    season.setNextSowTimeE(LibConstant.MAX_UINT32);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.yield),9);
    assertEq(uint256(weather.nextSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), LibConstant.MAX_UINT32);
  }

  // it("lastSowTime max", async function () {
  //     await this.season.setLastSowTimeE('900')
  //     await this.season.setNextSowTimeE(MAX_UINT32)
  //     await this.season.stepWeatherE(ethers.utils.parseEther('1'), '1');
  //     const weather = await this.season.weather();
  //     expect(weather.yield).to.equal(9)
  //     expect(weather.nextSowTime).to.equal(parseInt(MAX_UINT32))
  //     expect(weather.lastSowTime).to.equal(parseInt(MAX_UINT32))
  //   })


  

  function _beforeExtremeWeatherTest() public {
    season.setLastDSoilE(100000);
    season.setStartSoilE(10000);
    C.bean().mint(publius, 1000000000);
    field.incrementTotalPodsE(100000000000);
  }

  function _beforeEachExtremeWeatherTest() public {
    season.setYieldE(10);
  }

}