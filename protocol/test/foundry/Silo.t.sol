// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import { Sun } from "contracts/beanstalk/sun/SeasonFacet/Sun.sol";
import { MockSeasonFacet } from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import { MockSiloFacet } from "contracts/mocks/mockFacets/MockSiloFacet.sol";
import { MockFieldFacet } from "contracts/mocks/mockFacets/MockFieldFacet.sol";
import { Utils } from "./utils/Utils.sol";
import "./utils/TestHelper.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "contracts/C.sol";

contract SiloTest is MockSiloFacet, TestHelper {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
  
    function setUp() public {
        console.log("diamondSetup");
        setupDiamond();
        setupSilo();
    }

    function setupSilo() public {
        season.lightSunrise();
        vm.prank(brean);
        IERC20(C.bean()).approve(diamond, uint256(-1));
        vm.prank(siloChad);
        IERC20(C.bean()).approve(diamond, uint256(-1));
    }
    function testAAA() public {
        
    }
}