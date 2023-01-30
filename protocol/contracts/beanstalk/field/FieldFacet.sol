/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;


import {C} from "~/C.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibTransfer} from "~/libraries/Token/LibTransfer.sol";
import {LibDibbler} from "~/libraries/LibDibbler.sol";
import {LibPRBMath} from "~/libraries/LibPRBMath.sol";
import {LibSafeMath32} from "~/libraries/LibSafeMath32.sol";
import {LibSafeMath128} from "~/libraries/LibSafeMath128.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";

/**
 * @title FieldFacet
 * @notice Field sows Beans.
 * @author Publius, Brean
 */
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

    //////////// SOW ////////////

    /**
     * @notice Sow Beans in exchange for Pods.
     * @param amount The number of Beans to Sow
     * @param minWeather The mininum Temperature at which to Sow
     * @param mode The balance to transfer Beans from; see {LibTrasfer.From}
     * @return pods The number of Pods received.
     * @dev `minWeather` has precision of 1e6. Delegates to {sowWithMin} with `minSoil = amount`.
     * 
     * FIXME: rename `amount` to `beans`?
     * FIXME: rename `minWeather`?
     */
    function sow(uint256 amount, uint256 minWeather, LibTransfer.From mode)
        external
        payable
        returns (uint256 pods)
    {
        return sowWithMin(amount, minWeather, amount, mode);
    }

    /**
     * @notice Sow Beans in exchange for Pods. Use at least `minSoil`.
     * @param amount The number of Beans to Sow
     * @param minWeather The mininum Temperature at which to Sow
     * @param minSoil The minimum amount of Soil to use; reverts if there is less than this much Soil available upon execution
     * @param mode The balance to transfer Beans from; see {LibTrasfer.From}
     * @dev 
     * 
     * FIXME: rename to sowWithMinSoil? This has already been deployed.
     * FIXME: rename `amount` to `beans`?
     */
    function sowWithMin(
        uint256 amount,
        uint256 minWeather,
        uint256 minSoil,
        LibTransfer.From mode
    ) public payable returns (uint256 pods) {
        (uint256 sowAmount, uint256 _yield) = totalSoilAndYield();
        require(
            sowAmount >= minSoil && amount >= minSoil,
            "Field: Sowing below min or 0 pods."
        );
        require(
            _yield >= minWeather,
            "Field: Sowing below min weather."
        );
        if (amount < sowAmount) sowAmount = amount; 
        return _sow(sowAmount, mode, _yield);
    }

    /**
     * @dev Burn Beans, Sows at the provided `_yield`, increments the total
     * number of `beanSown`.
     */
    function _sow(uint256 amount, LibTransfer.From mode, uint256 _yield)
        internal
        returns (uint256 pods)
    {
        amount = LibTransfer.burnToken(C.bean(), amount, msg.sender, mode);
        pods = LibDibbler.sow(amount, _yield, msg.sender);
        s.f.beanSown = s.f.beanSown + uint128(amount); // safeMath not needed
    }

    //////////// HARVEST ////////////

    /**
     * @notice Harvest Pods from the Field.
     * @param plots List of plot IDs to Harvest.
     * @param mode The balance to transfer Beans to; see {LibTrasfer.To}
     * @dev Redeems Pods for Beans. When Pods become Harvestable, they are
     * redeemable for 1 Bean each.
     * 
     * The Beans used to pay Harvestable Pods are minted during {Sun.stepSun}.
     * Beanstalk holds these Beans until `harvest()` is called.
     *
     * Pods are "burned" when the corresponding Plot is deleted from 
     * `s.a[account].field.plots`.
     */
    function harvest(uint256[] calldata plots, LibTransfer.To mode)
        external
        payable
    {
        uint256 beansHarvested = _harvest(plots);
        LibTransfer.sendToken(C.bean(), beansHarvested, msg.sender, mode);
    }

    /**
     * @dev Ensure that each Plot is at least partially harvestable, burn the Plot,
     * update the total harvested, and emit a {Harvest} event.
     */
    function _harvest(uint256[] calldata plots)
        internal
        returns (uint256 beansHarvested)
    {
        for (uint256 i; i < plots.length; ++i) {
            // The Plot is partially harvestable if its index is less than
            // the current harvestable index.
            require(plots[i] < s.f.harvestable, "Field: Plot not Harvestable");
            uint256 harvested = harvestPlot(msg.sender, plots[i]);
            beansHarvested = beansHarvested.add(harvested);
        }
        s.f.harvested = s.f.harvested.add(beansHarvested);
        emit Harvest(msg.sender, plots, beansHarvested);
    }

    /**
     * @dev 
     * FIXME: rename to _harvestPlot
     */
    function harvestPlot(address account, uint256 plotId)
        private
        returns (uint256 harvestablePods)
    {
        // Check that `account` holds this Plot.
        uint256 pods = s.a[account].field.plots[plotId];
        require(pods > 0, "Field: no plot");

        // Calculate how many Pods are harvestable. 
        // Since we already checked that some Pods are harvestable
        harvestablePods = s.f.harvestable.sub(plotId);
        delete s.a[account].field.plots[plotId];

        // Check if there's a Pod Listing active for this Plot.
        if (s.podListings[plotId] > 0) {
            delete s.podListings[plotId];
            emit PodListingCancelled(msg.sender, plotId);
        }

        // If the entire Plot was harvested, exit.
        if (harvestablePods >= pods) {
            return pods;
        }
        
        // Create a new Plot with the remaining Pods.
        s.a[account].field.plots[plotId.add(harvestablePods)] = pods.sub(
            harvestablePods
        );
    }

    //////////// GETTERS ////////////

    /**
     * @notice Returns the total number of Pods ever minted.
     */
    function podIndex() public view returns (uint256) {
        return s.f.pods;
    }

    /**
     * @notice Returns the index below which Pods are Harvestable.
     */
    function harvestableIndex() public view returns (uint256) {
        return s.f.harvestable;
    }

    /**
     * @notice Returns the number of outstanding Pods.
     */
    function totalPods() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvested);
    }

    /**
     * @notice Returns the number of Pods that have ever been Harvested.
     */
    function totalHarvested() public view returns (uint256) {
        return s.f.harvested;
    }

    /**
     * @notice Returns the number of Pods that are currently Harvestable but
     * have not yet been Harvested.
     * @dev This is the number of Pods that Beanstalk is prepared to pay back,
     * but that haven’t yet been claimed via the `harvest()` function.
     */
    function totalHarvestable() public view returns (uint256) {
        return s.f.harvestable.sub(s.f.harvested);
    }

    /**
     * @notice Returns the number of Pods that are not yet Harvestable.
     * @dev Also referred to as the Pod Line.
     */
    function totalUnharvestable() public view returns (uint256) {
        return s.f.pods.sub(s.f.harvestable);
    }

    /**
     * @notice Returns the number of Pods remaining in a Plot.
     * @dev Plots are only stored in the `s.a[account].field.plots` mapping.
     */
    function plot(address account, uint256 plotId)
        public
        view
        returns (uint256 pods)
    {
        return s.a[account].field.plots[plotId];
    }

    /**
     * @dev Gets the current soil and yield. Provided as a gas optimization to 
     * prevent recalculation of {yield()} for some upstream functions.
     */
    function totalSoilAndYield() private view returns (uint256 _soil, uint256 _yield) {
        uint256 _yield = yield();

        // Below peg: Soil is fixed to the amount set during {stepWeather},
        // Yield is dynamic, starting small and logarithmically increasing to 
        // `s.f.yield` across the first 25 blocks of the Season.
        if (!s.season.abovePeg) {
            return (
                uint256(s.f.soil),
                _yield
            );
        }

        // Above peg: Yield is fixed to the amount set during {stepWeather}, 
        // Soil is dynamic
        return (
            LibDibbler.scaleSoilUp(
                uint256(s.f.soil), // min soil
                uint256(s.w.yield), // max yield
                _yield // yield adjusted by number of blocks since Sunrise
            ),
            _yield
        );
    }

    /**
     * @dev
     * 
     * ```
     * soilAbovePeg * yield = soil * maxYield = pods (when above peg)
     * soilAbovePeg = soil * maxYield / yield
     * ```
     * 
     * Need to cast s.w.yield to an uint256 due prevent overflow.
     */
    function totalSoil() external view returns (uint256) {
        // Below peg: Soil is fixed to the amount set during {stepWeather}.
        if (!s.season.abovePeg) {
            return uint256(s.f.soil);
        }

        // Above peg: Soil is dynamic
        return LibDibbler.scaleSoilUp(
            uint256(s.f.soil), // min soil
            uint256(s.w.yield), // max yield
            yield() // yield adjusted by number of blocks since Sunrise
        );
    }

    /**
     * @notice Returns the current yield (aka "Temperature") offered by Beanstalk.
     * @dev Yield has precision level 1e6 (1% = 1e6)
     */
    function yield() public view returns (uint256) {
        return LibDibbler.yield();
    }
    
    /**
     * @notice Peas are the potential remaining Pods that can be issued within a Season.
     * @dev FIXME: rename `maxPods`.
     */
    function peas() external view returns (uint256) {
        return uint256(LibDibbler.peas());
    }
}
