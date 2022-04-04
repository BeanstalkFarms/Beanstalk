/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/FieldFacet/FieldFacet.sol";

/**
 * @author Publius
 * @title Mock Field Facet
**/
contract MockFieldFacet is FieldFacet {

    using SafeMath for uint256;

    // for Testing purposes only
    uint32 mapToPlotIndex;
    mapping(uint32 => uint256) mapToPlots;
    mapping(uint32 => address) mapToAddress;

    function sowBeansAndIndex(uint256 amount) external returns (uint256) {
        mapToPlots[mapToPlotIndex] = s.f.pods;
        bean().transferFrom(msg.sender, address(this), amount);
        uint amountPods = _sowBeans(amount);
        mapToAddress[mapToPlotIndex] = msg.sender;
        mapToPlotIndex = mapToPlotIndex + 1;
        return amountPods;
    }

    function deletePlot(address account, uint256 index) external returns (uint256) {
        delete s.a[account].field.plots[index];
    }

    function resetField() public {

        for (uint32 i = 0; i < mapToPlotIndex; i++) {

            delete s.a[mapToAddress[i]].field.plots[mapToPlots[i]];
            delete s.podListings[mapToPlots[i]];
        }
    }
    function incrementTotalSoilE(uint256 amount) public {
        incrementTotalSoil(amount);
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
                s.a[accounts[i]].field.podAllowances[accounts[j]] = 0;
            }
        }
    }

    function incrementTotalSoil(uint256 amount) internal {
        s.f.soil = s.f.soil.add(amount);
    }

}
