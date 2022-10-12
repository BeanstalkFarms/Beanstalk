/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/Token/LibTransfer.sol";
import "../../libraries/LibDibbler.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Field sows Beans.
 **/
contract FieldFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;
    
    uint128 private constant DECIMAL = 1e6;

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

    //note minWeather has precision of 1e6
    function sow(uint256 amount, uint256 minWeather, LibTransfer.From mode)
        external
        payable
        returns (uint256)
    {
        // maybe instead put this as minWeather = 1? 
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
            sowAmount >= minSoil && amount >= minSoil && minSoil > 0,
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

    function totalSoil() public view returns (uint256) {
        if(s.season.AbovePeg){
            uint256 _yield = uint256(yield()).add(100 * DECIMAL);
            return uint256(s.f.soil).mulDiv(uint256(s.w.yield).add(100).mul(DECIMAL),_yield);
        }
        else{
            return uint256(s.f.soil);
        }
    }

    /// @dev yield now has precision level 1e6 (1% = 1e6)
    function yield() public view returns (uint256) {
        return LibDibbler.morningAuction();
    }

    /// @notice Peas are the potential pods that can be issued within a season.
    /// Returns the maximum pods issued within a season
    function maxPeas() external view returns (uint256) {
        return s.w.startSoil.mul(s.w.yield.add(100)).div(100);
    }

    /// Returns the remaining pods that can be sown within a season.
    function peas() external view returns (uint128) {
        return s.f.soil.mul(s.w.yield.add(100)).div(100);
    }
}
