/*
 SPDX-License-Identifier: MIT
*/
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/C.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/beanstalk/sun/SeasonFacet/SeasonFacet.sol";
import "contracts/beanstalk/sun/SeasonFacet/Sun.sol";
import {LibCurveMinting} from "contracts/libraries/Minting/LibCurveMinting.sol";

/**
 * @author Publius
 * @title MockAdminFacet provides various mock functionality
**/

contract MockAdminFacet is Sun {

    function mintBeans(address to, uint256 amount) external {
        C.bean().mint(to, amount);
    }

    function ripen(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToHarvestable(amount);
    }

    function fertilize(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToFertilizer(amount);
    }

    function rewardSilo(uint256 amount) external {
        C.bean().mint(address(this), amount);
        rewardToSilo(amount);
    }

    function forceSunrise() external {
        updateStart();
        SeasonFacet sf = SeasonFacet(address(this));
        sf.sunrise();
    }

    function rewardSunrise(uint256 amount) public {
        updateStart();
        s.season.current += 1;
        C.bean().mint(address(this), amount);
        rewardBeans(amount);
    }

    function fertilizerSunrise(uint256 amount) public {
        updateStart();
        s.season.current += 1;
        C.bean().mint(address(this), amount);
        rewardToFertilizer(amount*3);
    }

    function updateStart() private {
        SeasonFacet sf = SeasonFacet(address(this));
        int256 sa = s.season.current - sf.seasonTime();
        if (sa >= 0) s.season.start -= 3600 * (uint256(sa)+1);
    }

    function update3CRVOracle() public {
        LibCurveMinting.updateOracle();
    }

    function updateStemScaleSeason(uint16 season) public {
        s.season.stemScaleSeason = season;
    }

    function updateStems() public { 
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        for (uint256 i = 0; i < siloTokens.length; i++) {
            s.ss[siloTokens[i]].milestoneStem = int96(s.ss[siloTokens[i]].milestoneStem * 1e6);
        }
    }

    function upgradeStems() public { 
        updateStemScaleSeason(uint16(s.season.current));
        updateStems();
    }

}