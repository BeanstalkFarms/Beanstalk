/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/LibDibbler.sol";
import "../ReentrancyGuard.sol";

/**
 * @title FieldFacet
 * @author Publius
 * @notice FieldFacet is the entry point for sowing beans and harvesting pods.
 * 
 * FieldFacet          events, public functions for sowing and harvesting, and getters.
 * ↖ ReentrancyGuard   provides reentrancy guard modifier and access to {C}.
 */
contract FieldFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;


    /**
     * @notice Emitted from {LibDibbler.sowNoSoil} when an `account` creates a plot. 
     * A "plot" is a set of pods created in a single sow() or fund() call. 
     * A plot has two traits - the amount of pods, and the index (place in Line)
     * Plots are created from sowing beans, or from funding a fundraiser. 
     *
     * @param account The account that sowed beans for pods.
     * @param index The place of line of the created plot.
     * @param beans The amount of beans burnt to create the plot.
     * @param pods The amount of pods assocated with the created plot.
     */
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    /**
     * @notice Emitted when a `account` harvests a plot(s).

     * @param account The account that sowed beans for pods.
     * @param plots The set of plots that are being harvested. 
     * @param beans The amount of beans transferred to `account`. 
     */
    event Harvest(address indexed account, uint256[] plots, uint256 beans);

    /**
     * @notice Emitted when a pod listing is canceled. 
     * A plot can be cancelled directly, or when a farmer harvests a listed plot.  
     * @param account The account whose pod listing is cancelled.
     * @param index The set of plots that are being harvested.
     * @dev no two plots can have the same index.
     */
    event PodListingCancelled(address indexed account, uint256 index);

    //////////////////////// SOW ////////////////////////

    /** 
     * @notice sows `amount` for pods.
     * @param token Address of the whitelisted ERC20 token to Withdraw.
     * @param season The Season to Withdraw from.
     * @param amount Amount of `token` to Withdraw.
     * @return pods .
     * @dev see {sowWithMin}
     */
    function sow(uint256 amount, LibTransfer.From mode)
        external
        payable
        returns (uint256)
    {
        return sowWithMin(amount, amount, mode);
    }

    /** 
     * @notice sow functionality with a minimum specification.
     * @param amount beans to be sown
     * @param minAmount minimum amount of beans a farmer is willing to sow.
     * @param mode balance to pull tokens from. See {LibTransfer-From}.
     * @return pods amount of pods issued to the farmer.

     * @dev unlike `sow`, `sowWithMin` allows farmers to specify a 
     * minimum amount of beans to be sown.
     * This is useful in times of excess demand of soil, 
     * where farmers may not be able to sow the entire
     * specified amount, but can partially fill it. 
     */
    function sowWithMin(
        uint256 amount,
        uint256 minAmount,
        LibTransfer.From mode
    ) public payable returns (uint256) {
        uint256 sowAmount = s.f.soil;
        require(
            sowAmount >= minAmount && amount >= minAmount && minAmount > 0,
            "Field: Sowing below min or 0 pods."
        );
        if (amount < sowAmount) sowAmount = amount;
        return _sow(sowAmount, mode);
    }

    /** 
     * @notice internal sowing logic.
     * @param amount beans to be sown
     * @param mode balance to pull tokens from. See {LibTransfer-From}.
     * @return pods amount of pods issued to the farmer.
     */
    function _sow(uint256 amount, LibTransfer.From mode)
        internal
        returns (uint256 pods)
    {
        amount = LibTransfer.burnToken(C.bean(), amount, msg.sender, mode);
        pods = LibDibbler.sow(amount, msg.sender);
    }

    //////////////////////// HARVEST ////////////////////////

    /** 
     * @notice "harvests" a set of given plots.
     * @param plots a set of plots the user is harvesting.
     * @param mode balance to pull tokens from. See {LibTransfer-From}.
     * 
     * @dev "harvesting" means redeeming a pod for a bean.
     * a plot not need to be fully redeemable in order to be harvested.
     * the beans given here are previously minted at sunrise.
     */
    function harvest(uint256[] calldata plots, LibTransfer.To mode)
        external
        payable
    {
        uint256 beansHarvested = _harvest(plots);
        LibTransfer.sendToken(C.bean(), beansHarvested, msg.sender, mode);
    }

    /** 
     * @notice internal harvest logic.
     * @param plots a set of plots the user is harvesting.
     * @return beansHarvested amount of beans transferred to the farmer.
     *
     * @dev function interates through each plot to 
     * determine how many beans are harvested.
     * a farmer cannot specify the amount to harvest from a plot. 
     */
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

    /** 
     * @notice internal harvesting logic for a given plot.
     * @param account owner of the plot, used when cancelling a pod listing.
     * @param plotId the ID of a plot. also known as {index}
     * @return harvestablePods amount of pods that can be harvested
     *
     * @FIXME should we pick between index/plotID, as they are the same(?)
     */
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

    //////////////////////// GETTERS ////////////////////////

    /**
    * @notice Returns the global pod index.
    * This represents the total amount of pods ever issued.
    */
    function podIndex() public view returns (uint256) {
        return s.f.pods;
    }

    /**
    * @notice Returns the global harvestable index.
    * @dev This represents the total amount of pods
    * that were ever harvestable.
    */
    function harvestableIndex() public view returns (uint256) {
        return s.f.harvestable;
    }

    /**
    * @notice Returns the total outstanding pods.
    * @dev this includes pods that can be harvested.
    */
    function totalPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvested);
    }

    /**
    * @notice Returns the total amount of pods that were harvested.
    */
    function totalHarvested() public view returns (uint256) {
        return s.f.harvested;
    }
    
    /**
    * @notice Returns the total amount of pods that are currently
    * harvestable.
    */
    function totalHarvestable() public view returns (uint256) {
        return s.f.harvestable.sub(s.f.harvested);
    }

    /**
    * @notice Returns the total amount of pods that are currently
    * unharvestable.
    */
    function totalUnharvestable() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvestable);
    }

    /**
    * @notice Returns the total amount of pods associated with a plotID.
    */
    function plot(address account, uint256 plotId)
        public
        view
        returns (uint256)
    {
        return s.a[account].field.plots[plotId];
    }

    /**
    * @notice Returns the total amount soil currently being issued.
    * @dev this logic will be changed in a future bip. 
    */
    function totalSoil() public view returns (uint256) {
        return s.f.soil;
    }
}
