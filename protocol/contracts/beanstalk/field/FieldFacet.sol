/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "~/C.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
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
 * @dev 
 */
contract FieldFacet is ReentrancyGuard {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    /**
     * @notice Emitted from {LibDibbler.sowNoSoil} when an `account` creates a plot. 
     * A Plot is a set of Pods created in from a single {sow} or {fund} call. 
     * @param account The account that sowed Beans for Pods
     * @param index The place in line of the Plot
     * @param beans The amount of Beans burnt to create the Plot
     * @param pods The amount of Pods assocated with the created Plot
     */
    event Sow(
        address indexed account,
        uint256 index,
        uint256 beans,
        uint256 pods
    );

    /**
     * @notice Emitted when `account` claims the Beans associated with Harvestable Pods.
     * @param account The account that owns the `plots`
     * @param plots The indices of Plots that were harvested
     * @param beans The amount of Beans transferred to `account`
     */
    event Harvest(address indexed account, uint256[] plots, uint256 beans);

    /**
     * @param account The account that created the Pod Listing
     * @param index The index of the Plot listed
     * @dev NOTE: must mirrow {Listing.PodListingCancelled}
     */
    event PodListingCancelled(address indexed account, uint256 index);

    //////////////////// SOW ////////////////////

    /**
     * @notice Sow Beans in exchange for Pods.
     * @param beans The number of Beans to Sow
     * @param minTemperature The minimum Temperature at which to Sow
     * @param mode The balance to transfer Beans from; see {LibTrasfer.From}
     * @return pods The number of Pods received
     * @dev 
     * 
     * `minTemperature` has precision of 1e6. Wraps {sowWithMin} with `minSoil = beans`.
     * 
     * NOTE: previously minTemperature was measured to 1e2
     * 
     * Rationale for {sow} accepting a `minTemperature` parameter:
     * If someone sends a Sow transaction at the end of a Season, it could be 
     * executed early in the following Season, at which time the temperature may be
     * significantly lower due to Morning Auction functionality.
     * 
     * FIXME Migration notes:
     * - Added `minTemperature` as second parameter
     * - `minTemperature` is uint256 measured to 1e6 instead of uint32
     */
    function sow(
        uint256 beans,
        uint256 minTemperature,
        LibTransfer.From mode
    )
        external
        payable
        returns (uint256 pods)
    {
        return sowWithMin(beans, minTemperature, beans, mode);
    }

    /**
     * @notice Sow Beans in exchange for Pods. Use at least `minSoil`.
     * @param beans The number of Beans to Sow
     * @param minTemperature The minimum Temperature at which to Sow
     * @param minSoil The minimum amount of Soil to use; reverts if there is 
     * less than this much Soil available upon execution
     * @param mode The balance to transfer Beans from; see {LibTrasfer.From}
     * @return pods The number of Pods received
     */
    function sowWithMin(
        uint256 beans,
        uint256 minTemperature,
        uint256 minSoil,
        LibTransfer.From mode
    ) public payable returns (uint256 pods) {
        // `soil` is the remaining Soil
        (uint256 soil, uint256 morningTemperature) = _totalSoilAndTemperature();

        require(
            soil >= minSoil && beans >= minSoil,
            "Field: Soil Slippage"
        );
        require(
            morningTemperature >= minTemperature,
            "Field: Temperature Slippage"
        );

        // If beans >= soil, Sow all of the remaining Soil
        // Logic is inverted to overwrite memory var `soil` instead of calldata `beans`
        if (beans < soil) {
            soil = beans; 
        }

        // 1 Bean is Sown in 1 Soil, i.e. soil = beans
        return _sow(soil, morningTemperature, mode);
    }

    /**
     * @dev Burn Beans, Sows at the provided `morningTemperature`, increments the total
     * number of `beanSown`.
     * 
     * NOTE: {FundraiserFacet} also burns Beans but bypasses the soil mechanism
     * by calling {LibDibbler.sowWithMin} which bypasses updates to `s.f.beanSown`
     * and `s.f.soil`. This is by design, as the Fundraiser has no impact on peg
     * maintenance and thus should not change the supply of Soil.
     */
    function _sow(uint256 beans, uint256 morningTemperature, LibTransfer.From mode)
        internal
        returns (uint256 pods)
    {
        beans = LibTransfer.burnToken(C.bean(), beans, msg.sender, mode);
        pods = LibDibbler.sow(beans, morningTemperature, msg.sender);
        s.f.beanSown = s.f.beanSown + SafeCast.toUint128(beans); // SafeMath not needed
    }

    //////////////////// HARVEST ////////////////////

    /**
     * @notice Harvest Pods from the Field.
     * @param plots List of plot IDs to Harvest
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
            uint256 harvested = _harvestPlot(msg.sender, plots[i]);
            beansHarvested = beansHarvested.add(harvested);
        }
        s.f.harvested = s.f.harvested.add(beansHarvested);
        emit Harvest(msg.sender, plots, beansHarvested);
    }

    /**
     * @dev Check if a Plot is at least partially Harvestable; calculate how many
     * Pods are Harvestable, create a new Plot if necessary.
     */
    function _harvestPlot(address account, uint256 index)
        private
        returns (uint256 harvestablePods)
    {
        // Check that `account` holds this Plot.
        uint256 pods = s.a[account].field.plots[index];
        require(pods > 0, "Field: no plot");

        // Calculate how many Pods are harvestable. 
        // The upstream _harvest function checks that at least some Pods 
        // are harvestable.
        harvestablePods = s.f.harvestable.sub(index);
        delete s.a[account].field.plots[index];

        // Cancel any active Pod Listings active for this Plot.
        // Note: duplicate of {Listing._cancelPodListing} without the 
        // ownership check, which is done above.
        if (s.podListings[index] > 0) {
            delete s.podListings[index];
            emit PodListingCancelled(msg.sender, index);
        }

        // If the entire Plot was harvested, exit.
        if (harvestablePods >= pods) {
            return pods;
        }
        
        // Create a new Plot with remaining Pods.
        s.a[account].field.plots[index.add(harvestablePods)] = pods.sub(
            harvestablePods
        );
    }

    //////////////////// GETTERS ////////////////////

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
    function plot(address account, uint256 index)
        public
        view
        returns (uint256 pods)
    {
        return s.a[account].field.plots[index];
    }

    /**
     * @dev Gets the current `soil` and `morningTemperature`. Provided as a gas 
     * optimization to prevent recalculation of {LibDibbler.morningTemperature} for 
     * upstream functions.
     *
     * Note: the `soil` return value is symmetric with `totalSoil`.
     */
    function _totalSoilAndTemperature() private view returns (uint256 soil, uint256 morningTemperature) {
        uint256 morningTemperature = LibDibbler.morningTemperature();

        // Below peg: Soil is fixed to the amount set during {stepWeather}.
        // Morning Temperature is dynamic, starting small and logarithmically 
        // increasing to `s.w.t` across the first 25 blocks of the Season.
        if (!s.season.abovePeg) {
            return (
                uint256(s.f.soil),
                morningTemperature
            );
        }

        // Above peg: the maximum amount of Pods that Beanstalk is willing to mint
        // stays fixed; since {morningTemperature} is scaled down when `delta < 25`, we
        // need to scale up the amount of Soil to hold Pods constant.
        return (
            LibDibbler.scaleSoilUp(
                uint256(s.f.soil), // max soil offered this Season, reached when `t >= 25`
                uint256(s.w.t).mul(LibDibbler.TEMPERATURE_PRECISION), // max temperature
                morningTemperature // temperature adjusted by number of blocks since Sunrise
            ),
            morningTemperature
        );
    }

    /**
     * @dev
     * 
     * ```
     * soilAbovePeg * temperature = soil * maxTemperature = pods (when above peg)
     * soilAbovePeg = soil * maxTemperature / temperature
     * ```
     * 
     * Need to cast s.w.t to an uint256 due prevent overflow.
     * 
     * FIXME: probably should be named {remainingSoil}.
     */
    function totalSoil() external view returns (uint256) {
        // Below peg: Soil is fixed to the amount set during {stepWeather}.
        if (!s.season.abovePeg) {
            return uint256(s.f.soil);
        }
        // Above peg: Soil is dynamic
        return LibDibbler.scaleSoilUp(
            uint256(s.f.soil), // min soil
            uint256(s.w.t).mul(LibDibbler.TEMPERATURE_PRECISION), // max temperature
            LibDibbler.morningTemperature() // temperature adjusted by number of blocks since Sunrise
        );
    }

    /**
     * @notice DEPRECATED: Returns the current yield (aka "Temperature") offered by Beanstalk
     * when burning Beans in exchange for Pods.
     * @dev Left for backwards compatibility. Scales down the {morningTemperature}. There
     * is a loss of precision (max 1%) during this operation.
     */
    function yield() external view returns (uint32) {
        return SafeCast.toUint32(
            LibDibbler.morningTemperature().div(LibDibbler.TEMPERATURE_PRECISION)
        );
    }

    function temperature() external view returns (uint256) {
        return LibDibbler.morningTemperature();
    }
    
    /**
     * @notice Peas are the potential remaining Pods that can be issued within a Season.
     * @dev FIXME: rename 
     * 
     * Can't use totalPods
     * remainingPods
     */
    function peas() external view returns (uint256) {
        return uint256(LibDibbler.peas());
    }
}
