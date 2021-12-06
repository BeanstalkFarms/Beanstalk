/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/FieldFacet/FieldFacet.sol";

/**
 * @author Publius
 * @title Mock Field Facet
**/
contract MockFieldFacet is FieldFacet {

    using SafeMath for uint256;

    function incrementTotalHarvestableE(uint256 amount) public {
        bean().mint(address(this), amount);
        s.f.harvestable = s.f.harvestable.add(amount);
    }

    function incrementTotalPodsE(uint256 amount) public {
        s.f.pods = s.f.pods + amount;
    }

    function setFieldAmountsE(uint256 soil, uint256 harvestable, uint256 pods) public {
        incrementTotalSoil(soil);
        s.f.harvestable = s.f.harvestable.add(harvestable);
        s.f.pods = s.f.pods.add(pods);
    }

    function resetAllowances(address[] memory accounts) public {
        for (uint i = 0; i < accounts.length; i++) {
            for (uint j = 0; j < accounts.length; j++) {
                setAllowancePods(accounts[i], accounts[j], 0);
            }
        }
    }

    function incrementTotalSoil(uint256 amount) internal {
        s.f.soil = s.f.soil.add(amount);
    }

}
