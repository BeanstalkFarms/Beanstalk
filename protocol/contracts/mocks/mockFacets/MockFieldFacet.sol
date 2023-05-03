/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "~/beanstalk/field/FieldFacet.sol";

/**
 * @author Publius
 * @title Mock Field Facet
**/
contract MockFieldFacet is FieldFacet {

    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

    function incrementTotalSoilE(uint128 amount) external {
        s.f.soil = s.f.soil.add(amount);
    }

    function incrementTotalHarvestableE(uint256 amount) external {
        C.bean().mint(address(this), amount);
        s.f.harvestable = s.f.harvestable.add(amount);
    }

    function incrementTotalPodsE(uint256 amount) external {
        s.f.pods = s.f.pods + amount;
    }

    function totalRealSoil() external view returns (uint256) {
        return s.f.soil;
    }

    function beanSown() external view returns (uint256) {
        return s.f.beanSown;
    }
}
