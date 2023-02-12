// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import { Sun } from "~/beanstalk/sun/SeasonFacet/Sun.sol";
import { MockSeasonFacet } from "~/mocks/mockFacets/MockSeasonFacet.sol";
import { MockSiloFacet } from "~/mocks/mockFacets/MockSiloFacet.sol";
import { MockFieldFacet } from "~/mocks/mockFacets/MockFieldFacet.sol";
import { Utils } from "./utils/Utils.sol";
import "./utils/TestHelper.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/C.sol";

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
        console.log("testAAA");
    }
}