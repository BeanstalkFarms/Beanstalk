// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;


import { Weather } from "~/beanstalk/sun/SeasonFacet/Weather.sol";
import "test/foundry/utils/TestHelper.sol";
import "test/foundry/utils/LibConstant.sol";

contract ComplexWeatherTest is Weather, TestHelper {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;
  using Decimal for Decimal.D256;


  struct WeatherData {
      uint256 unharvestablePods;
      uint256 totalOutstandingBeans;
      uint256 startingSoil;
      uint128 endingSoil;
      uint256 lastSoil;
      int256 priceAvg;
      uint32 startingWeather;
      uint32 lastSowTime;
      uint32 thisSowTime;
      bool wasRaining;
      uint256 rainingSeasons;
      uint256 rainStalk;
      uint32 newWeather;
      uint256 code;
      bool postRain;
  }
  
  function setUp() public {
    setupDiamond();
  }

  

  ///////////////////////// Utilities /////////////////////////
  //Complex Weather
  function testComplexWeatherCases() public {
    WeatherData[12] memory data;
    data = [
        WeatherData(0,1,0,0,0,1,1,0,4294967295,true,1,1,1,4,true),
        WeatherData(0,0,0,0,0,1,1,0,4294967295,true,1,1,1,24,false),
        WeatherData(49,1000,0,0,0,-1,1,0,4294967295,true,1,1,4,0,false),
        WeatherData(51,1000,0,0,0,-1,1,0,4294967295,true,1,1,4,8,false),
        WeatherData(151,1000,1,0,0,-1,1,0,4294967295,true,1,1,2,18,false),
        WeatherData(251,1000,1,0,1,-1,1,0,4294967295,false,1,1,4,25,false), 
        WeatherData(0,1,0,0,0,1,100,0,4294967295,true,1,1,99,4,true), 
        WeatherData(0,1,0,0,0,100,1,0,4294967295,false,26,1,1,4,true),
        WeatherData(151,1,0,0,0,-1,1,0,4294967295,false,26,1,4,24,false),
        WeatherData(251,1000,1,0,1,-1,1,4294967295,4294967295,true,1,1,4,25,false),
        WeatherData(251,1000,1,0,1,0,1,0,0,true,1,1,2,26,false),
        WeatherData(451,1000,1,0,1,0,1,0,0,true,1,1,2,26,false)
    ];
    vm.startPrank(brean);
    console.log("Testing for complex weather cases:");
      for(uint256 i = 0; i< data.length; ++i){
        season.setMaxTempE(data[i].startingWeather);

        C.bean().burn(C.bean().balanceOf(brean));
        uint256 lastDSoil = data[i].lastSoil;
        uint256 startSoil = data[i].startingSoil;
        uint128 endSoil = data[i].endingSoil;
        int256 deltaB = data[i].priceAvg;
        uint256 pods = data[i].unharvestablePods;
      
      
        bool raining = data[i].wasRaining;
        bool rainRoots = (data[i].rainStalk == 1)? true : false;

        C.bean().mint(brean,data[i].totalOutstandingBeans);
        
        season.setLastSowTimeE(data[i].lastSowTime);
        season.setNextSowTimeE(data[i].thisSowTime);
        season.stepWeatherWithParams(pods, lastDSoil, uint128(startSoil-endSoil), endSoil, deltaB, raining, rainRoots);

        //check that the season weather is the same as the one specified in the array:
        assertEq(uint256(season.weather().t), uint256(data[i].newWeather));
        // if(data[i].totalOutstandingBeans != 0){
          
        // }
        console.log("Case", i , "complete.");
        // TODO ADD EMIT EVENT TRACKING
    }
    vm.stopPrank();
  }
}

contract ExtremeWeatherTest is Weather, TestHelper {
  using SafeMath for uint256;
  using LibSafeMath32 for uint32;
  struct WeatherData {
      uint256 unharvestablePods;
      uint256 totalOutstandingBeans;
      uint256 startingSoil;
      uint256 endingSoil;
      uint256 lastSoil;
      int256 priceAvg;
      uint32 startingWeather;
      uint32 lastSowTime;
      uint32 thisSowTime;
      bool wasRaining;
      uint256 rainingSeasons;
      uint256 rainStalk;
      uint32 newWeather;
      uint256 code;
      bool postRain;
  }
  
  function setUp() public {
    setupDiamond();
    _beforeExtremeWeatherTest();
  }

  //Extreme weather
  function testExtremeNextSowTimeNow() public {
    console.log("NextSowTimeNow");
    _beforeEachExtremeWeatherTest();
    season.setLastSowTimeE(1);
    season.setNextSowTimeE(10);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),7);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 10);
  }

  function testExtremeLastSowTimeMax() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimeMax");
    season.setLastSowTimeE(LibConstant.MAX_UINT32);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),7);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTime61Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime61Delta");
    season.setLastSowTimeE(1061);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),7);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTime60Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime60Delta");
    season.setLastSowTimeE(1060);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),9);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeNeg60Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimeNeg60Delta");
    season.setLastSowTimeE(940);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),9);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeNeg100Delta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTime100Delta");
    season.setLastSowTimeE(900);
    season.setNextSowTimeE(1000);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),10);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), 1000);
  }

  function testExtremeLastSowTimeDelta() public {
    _beforeEachExtremeWeatherTest();
    console.log("LastSowTimeDelta");
    season.setLastDSoilE(1);  
    season.setLastSowTimeE(900);
    season.setNextSowTimeE(LibConstant.MAX_UINT32);
    season.stepWeatherE(1 ether,1);
    Storage.Weather memory weather = season.weather();
    assertEq(uint256(weather.t),9);
    assertEq(uint256(weather.thisSowTime), LibConstant.MAX_UINT32);
    assertEq(uint256(weather.lastSowTime), LibConstant.MAX_UINT32);
  }


  

  function _beforeExtremeWeatherTest() public {
    season.setLastDSoilE(100000);
    C.bean().mint(publius, 1000000000);
    field.incrementTotalPodsE(100000000000);
  }

  function _beforeEachExtremeWeatherTest() public {
    season.setMaxTempE(10);
  }

}