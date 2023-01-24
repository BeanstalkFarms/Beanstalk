/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibDibbler.sol";
import "../ReentrancyGuard.sol";


/**
 * @author Publius, Brean
 * @title Field sows Beans.
 **/
contract FieldFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event PodListingCancelled(address indexed account, uint256 index);

    /**
     * Sow
     **/

    /// @dev minWeather has precision of 1e6
    function sow(uint256 amount, uint256 minWeather, LibTransfer.From mode)
        external
        payable
        returns (uint256)
    {
        return sowWithMin(amount, minWeather, amount, mode);
    }

    function sowWithMin(
        uint256 amount,
        uint256 minWeather,
        uint256 minSoil,
        LibTransfer.From mode
    ) public payable returns (uint256) {
        uint256 sowAmount = totalSoil();
        require(
            sowAmount >= minSoil && amount >= minSoil,
            "Field: Sowing below min or 0 pods."
        );
        require(
            yield() >= minWeather,
            "Field: Sowing below min weather."
        );
        if (amount < sowAmount) sowAmount = amount; 
        return _sow(sowAmount, mode);
    }

    function _sow(uint256 amount, LibTransfer.From mode)
        internal
        returns (uint256 pods)
    {
        amount = LibTransfer.burnToken(C.bean(), amount, msg.sender, mode);
        pods = LibDibbler.sow(amount, msg.sender);
        s.f.beanSown = s.f.beanSown + uint128(amount); // safeMath not needed
    }

    /**
     * Harvest
     **/

    function harvest(uint256[] calldata plots, LibTransfer.To mode)
        external
        payable
    {
        uint256 beansHarvested = _harvest(plots);
        LibTransfer.sendToken(C.bean(), beansHarvested, msg.sender, mode);
    }

    function _harvest(uint256[] calldata plots)
        internal
        returns (uint256 beansHarvested)
    {
        for (uint256 i; i < plots.length; ++i) {
            require(plots[i] < s.f.harvestable, "Field: Plot not Harvestable.");
            uint256 harvested = harvestPlot(msg.sender, plots[i]);
            beansHarvested = beansHarvested.add(harvested);
        }
        s.f.harvested = s.f.harvested.add(beansHarvested);
        emit Harvest(msg.sender, plots, beansHarvested);
    }

    function harvestPlot(address account, uint256 plotId)
        private
        returns (uint256 harvestablePods)
    {
        uint256 pods = s.a[account].field.plots[plotId];
        require(pods > 0, "Field: Plot is empty.");
        harvestablePods = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];
        if (s.podListings[plotId] > 0) {
            delete s.podListings[plotId];
            emit PodListingCancelled(msg.sender, plotId);
        }
        if (harvestablePods >= pods) return pods;
        s.a[account].field.plots[plotId.add(harvestablePods)] = pods.sub(
            harvestablePods
        );
    }

    /**
     * Getters
     **/

    function podIndex() public view returns (uint256) {
        return s.f.pods;
    }

    function harvestableIndex() public view returns (uint256) {
        return s.f.harvestable;
    }

    function totalPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvested);
    }

    function totalHarvested() public view returns (uint256) {
        return s.f.harvested;
    }

    function totalHarvestable() public view returns (uint256) {
        return s.f.harvestable.sub(s.f.harvested);
    }

    function totalUnharvestable() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvestable);
    }

    function plot(address account, uint256 plotId)
        public
        view
        returns (uint256)
    {
        return s.a[account].field.plots[plotId];
    }

    /// @dev FIXME: overlap with LibDibbler
    function totalSoil() public view returns (uint256) {
        if(s.season.abovePeg) {
            uint256 _yield = yield().add(1e8); 
            return uint256(s.f.soil).mulDiv(100e6,_yield,LibPRBMath.Rounding.Up); 
        } else {
            return uint256(s.f.soil);
        }
    }

    /// @dev yield has precision level 1e6 (1% = 1e6)
    function yield() public view returns (uint256) {
        return LibDibbler.yield();
    }

    /// @dev peas are the potential pods that can be issued within a season.
    function peas() external view returns (uint256) {
       if (s.season.abovePeg) {
            return s.f.soil;
        } else {
            return s.f.soil.mul(100 + s.w.yield).div(100);
        }
    }
}
