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

    function incrementTotalSoilE(uint256 amount) public {
        incrementTotalSoil(amount);
        ensureSoilBounds();
    }

    function incrementTotalSoilEE(uint256 amount) public {
        incrementTotalSoil(amount);
    }

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

    function ensureSoilBounds() internal returns (int256) {
        uint256 minTotalSoil = C.getMinSoilRatioCap().mul(bean().totalSupply()).div(100);
        if (s.f.soil < minTotalSoil) {
            uint256 amount = minTotalSoil.sub(s.f.soil);
            incrementTotalSoil(amount);
            return int256(amount);
        }
        uint256 maxTotalSoil = C.getMaxSoilRatioCap().mul(bean().totalSupply()).div(100);
        if (s.f.soil > maxTotalSoil) {
            uint256 amount = s.f.soil.sub(maxTotalSoil);
            s.f.soil = s.f.soil.sub(amount, "MockField: Not enough Soil.");
            return -int256(amount);
        }
        return 0;
    }

}
