/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanDibbler.sol";

/**
 * @author Publius
 * @title Field sows Beans.
**/
contract FieldFacet is BeanDibbler {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    /**
     * Sow
    **/

    function sowBeans(uint256 amount) external returns (uint256) {
        return sowBeansWithMin(amount, amount);
    }

    function sowBeansWithMin(uint256 amount, uint256 minAmount) public returns (uint256) {
        uint256 sowAmount = s.f.soil;
        require(
            sowAmount >= minAmount && 
            amount >= minAmount && 
            minAmount > 0, 
            "Field: Sowing below min or 0 pods."
        );
        if (amount < sowAmount) sowAmount = amount;
        return _sowBeans(sowAmount, true);
    }

    // Helpers

    function getSowAmount(uint256 amount, uint256 minAmount) private view returns (uint256 maxSowAmount) {
        maxSowAmount = s.f.soil;
        require(
            maxSowAmount >= minAmount && 
            amount >= minAmount && 
            minAmount > 0, 
            "Field: Sowing below min or 0 pods."
        );
        if (amount < maxSowAmount) return amount;
    }

    // Harvest

    function harvest(uint256[] calldata plots) external {
        uint256 beansHarvested = _harvest(plots);
        IBean(s.c.bean).transfer(msg.sender, beansHarvested);
    }

    function _harvest(uint256[] calldata plots) private returns (uint256 beansHarvested) {
        for (uint256 i = 0; i < plots.length; i++) {
            require(plots[i] < s.f.harvestable, "Claim: Plot not harvestable.");
            require(s.a[msg.sender].field.plots[plots[i]] > 0, "Claim: Plot not harvestable.");
            uint256 harvested = harvestPlot(msg.sender, plots[i]);
            beansHarvested = beansHarvested.add(harvested);
        }
        require(s.f.harvestable.sub(s.f.harvested) >= beansHarvested, "Claim: Not enough Harvestable.");
        s.f.harvested = s.f.harvested.add(beansHarvested);
        emit Harvest(msg.sender, plots, beansHarvested);
    }

    function harvestPlot(address account, uint256 plotId) private returns (uint256) {
        uint256 pods = s.a[account].field.plots[plotId];
        require(pods > 0, "Claim: Plot is empty.");
        uint256 harvestablePods = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];
        if (s.podListings[plotId] > 0) {
            delete s.podListings[plotId];
            emit PodListingCancelled(msg.sender, plotId);
        }       
        if (harvestablePods >= pods) return pods;
        s.a[account].field.plots[plotId.add(harvestablePods)] = pods.sub(harvestablePods);
        return harvestablePods;
    }
}
