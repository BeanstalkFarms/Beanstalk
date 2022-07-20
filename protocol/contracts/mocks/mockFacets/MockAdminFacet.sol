/*
 SPDX-License-Identifier: MIT
*/
import "../../C.sol";
import "../../farm/facets/SeasonFacet/SeasonFacet.sol";

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title MockAdminFacet provides various mock functionality
**/

contract MockAdminFacet is Sun {

    function mintBeans(address to, uint256 amount) external {
        C.bean().mint(to, amount);
    }

    function ripenHarvestable(uint256 amount) external {
        rewardToHarvestable(amount);
    }

    function forceSunrise() external {
        SeasonFacet sf = SeasonFacet(address(this));
        int256 sa = sf.season() - sf.seasonTime();
        if (sa >= 0) {
            s.season.start -= 3600 * (uint256(sa)+1);
        }
        sf.sunrise();
    }
}