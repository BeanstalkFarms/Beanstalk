/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/FieldFacet.sol";

/**
 * @author Publius
 * @title Mock Field Facet
**/
contract MockFieldFacet is FieldFacet {

    using SafeMath for uint256;

    function incrementTotalSoilE(uint256 amount) external {
        s.f.soil = s.f.soil.add(amount);
    }

    function incrementTotalHarvestableE(uint256 amount) external {
        C.bean().mint(address(this), amount);
        s.f.harvestable = s.f.harvestable.add(amount);
    }

    function incrementTotalPodsE(uint256 amount) external {
        s.f.pods = s.f.pods + amount;
    }
}
