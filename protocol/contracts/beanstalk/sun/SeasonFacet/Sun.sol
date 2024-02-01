// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/SafeCast.sol";
import "contracts/libraries/Decimal.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "contracts/libraries/LibFertilizer.sol";
import "contracts/libraries/LibSafeMath128.sol";
import "contracts/libraries/LibPRBMath.sol";
import "contracts/C.sol";
import "./Oracle.sol";

/**
 * @title Sun
 * @author Publius
 * @notice Sun controls the minting of new Beans to Fertilizer, the Field, and the Silo.
 */
contract Sun is Oracle {
    using SafeCast for uint256;
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;
    using Decimal for Decimal.D256;

    /// @dev When Fertilizer is Active, it receives 1/3 of new Bean mints.
    uint256 private constant FERTILIZER_DENOMINATOR = 3;

    /// @dev After Fertilizer, Harvestable Pods receive 1/2 of new Bean mints. 
    uint256 private constant HARVEST_DENOMINATOR = 2;

    /// @dev When the Pod Rate is high, issue less Soil.
    uint256 private constant SOIL_COEFFICIENT_HIGH = 0.5e18;
    
    /// @dev When the Pod Rate is low, issue more Soil.
    uint256 private constant SOIL_COEFFICIENT_LOW = 1.5e18;

    /**
     * @notice Emitted during Sunrise when Beans are distributed to the Field, the Silo, and Fertilizer.
     * @param season The Season in which Beans were distributed.
     * @param toField The number of Beans distributed to the Field.
     * @param toSilo The number of Beans distributed to the Silo.
     * @param toFertilizer The number of Beans distributed to Fertilizer.
     */
    event Reward(
        uint32 indexed season,
        uint256 toField,
        uint256 toSilo,
        uint256 toFertilizer
    );

    /**
     * @notice Emitted during Sunrise when Beanstalk adjusts the amount of available Soil.
     * @param season The Season in which Soil was adjusted.
     * @param soil The new amount of Soil available.
     */
    event Soil(
        uint32 indexed season,
        uint256 soil
    );

    //////////////////// SUN INTERNAL ////////////////////
    
    /**
     * @param deltaB Pre-calculated deltaB from {Oracle.stepOracle}.
     * @param caseId Pre-calculated Weather case from {Weather.stepWeather}.
     */
    function stepSun(int256 deltaB, uint256 caseId) internal {
        // Above peg
        if (deltaB > 0) {
            uint256 newHarvestable = rewardBeans(uint256(deltaB));
            setSoilAbovePeg(newHarvestable, caseId);
            s.season.abovePeg = true;
        } 

        // Below peg
        else {
            setSoil(uint256(-deltaB));
            s.season.abovePeg = false;
        }
    }

    //////////////////// REWARD BEANS ////////////////////

    /**
     * @dev Mints and distributes Beans to Fertilizer, the Field, and the Silo.
     */
    function rewardBeans(uint256 newSupply) internal returns (uint256 newHarvestable) {
        uint256 newFertilized;
        
        C.bean().mint(address(this), newSupply);

        // Distribute first to Fertilizer if some Fertilizer are active
        if (s.season.fertilizing) {
            newFertilized = rewardToFertilizer(newSupply);
            newSupply = newSupply.sub(newFertilized);
        }

        // Distribute next to the Field if some Pods are still outstanding
        if (s.f.harvestable < s.f.pods) {
            newHarvestable = rewardToHarvestable(newSupply);
            newSupply = newSupply.sub(newHarvestable);
        }

        // Distribute remainder to the Silo
        rewardToSilo(newSupply);

        emit Reward(s.season.current, newHarvestable, newSupply, newFertilized);
    }

    /**
     * @dev Distributes Beans to Fertilizer.
     */
    function rewardToFertilizer(uint256 amount)
        internal
        returns (uint256 newFertilized)
    {
        // 1/3 of new Beans being minted
        uint256 maxNewFertilized = amount.div(FERTILIZER_DENOMINATOR);

        // Get the new Beans per Fertilizer and the total new Beans per Fertilizer
        uint256 newBpf = maxNewFertilized.div(s.activeFertilizer);
        uint256 oldTotalBpf = s.bpf;
        uint256 newTotalBpf = oldTotalBpf.add(newBpf);

        // Get the end Beans per Fertilizer of the first Fertilizer to run out.
        uint256 firstEndBpf = s.fFirst;

        // If the next fertilizer is going to run out, then step BPF according
        while(newTotalBpf >= firstEndBpf) {
            // Calculate BPF and new Fertilized when the next Fertilizer ID ends
            newBpf = firstEndBpf.sub(oldTotalBpf);
            newFertilized = newFertilized.add(newBpf.mul(s.activeFertilizer));

            // If there is no more fertilizer, end
            if (!LibFertilizer.pop()) {
                s.bpf = uint128(firstEndBpf); // SafeCast unnecessary here.
                s.fertilizedIndex = s.fertilizedIndex.add(newFertilized);
                require(s.fertilizedIndex == s.unfertilizedIndex, "Paid != owed");
                return newFertilized;
            }

            // Calculate new Beans per Fertilizer values
            newBpf = maxNewFertilized.sub(newFertilized).div(s.activeFertilizer);
            oldTotalBpf = firstEndBpf;
            newTotalBpf = oldTotalBpf.add(newBpf);
            firstEndBpf = s.fFirst;
        }

        // Distribute the rest of the Fertilized Beans
        s.bpf = uint128(newTotalBpf); // SafeCast unnecessary here.
        newFertilized = newFertilized.add(newBpf.mul(s.activeFertilizer));
        s.fertilizedIndex = s.fertilizedIndex.add(newFertilized);
    }

    /**
     * @dev Distributes Beans to the Field. The next `amount` Pods in the Pod Line
     * become Harvestable.
     */
    function rewardToHarvestable(uint256 amount)
        internal    
        returns (uint256 newHarvestable)
    {
        uint256 notHarvestable = s.f.pods - s.f.harvestable; // Note: SafeMath is redundant here.
        newHarvestable = amount.div(HARVEST_DENOMINATOR);
        newHarvestable = newHarvestable > notHarvestable
            ? notHarvestable
            : newHarvestable;
        s.f.harvestable = s.f.harvestable.add(newHarvestable);
    }

    /**
     * @dev Distribute Beans to the Silo. Stalk & Earned Beans are created here;
     * Farmers can claim them through {SiloFacet.plant}.
     */
    function rewardToSilo(uint256 amount) internal {
        // NOTE that the Beans have already been minted (see {rewardBeans}).
        //
        // `s.earnedBeans` is an accounting mechanism that tracks the total number
        // of Earned Beans that are claimable by Stalkholders. When claimed via `plant()`,
        // it is decremented. See {Silo.sol:_plant} for more details.
        s.earnedBeans = s.earnedBeans.add(amount);

        // Mint Stalk (as Earned Stalk). Farmers can claim their Earned Stalk via {SiloFacet.sol:plant}.
        //
        // Stalk is created here, rather than in {rewardBeans}, because only
        // Beans that are allocated to the Silo will receive Stalk.
        // Constant is used here rather than s.ss[BEAN].stalkIssuedPerBdv
        // for gas savings.
        uint256 seasonStalk = amount.mul(C.STALK_PER_BEAN);
        s.s.stalk = s.s.stalk.add(seasonStalk);

        // removed at ebip-13. Will be replaced upon seed gauge BIP.
        // s.newEarnedStalk = seasonStalk.toUint128();
        // s.vestingPeriodRoots = 0;

        s.siloBalances[C.BEAN].deposited = s
            .siloBalances[C.BEAN]
            .deposited
            .add(amount.toUint128());

        // SafeCast not necessary as the block above will fail if amount > type(uint128).max.
        s.siloBalances[C.BEAN].depositedBdv = s
            .siloBalances[C.BEAN]
            .depositedBdv
            .add(uint128(amount));
    }

    //////////////////// SET SOIL ////////////////////

    /**
     * @param newHarvestable The number of Beans that were minted to the Field.
     * @param caseId The current Weather Case.
     * @dev When above peg, Beanstalk wants to gauge demand for Soil. Here it
     * issues the amount of Soil that would result in the same number of Pods
     * as became Harvestable during the last Season.
     * 
     * When the Pod Rate is high, Beanstalk issues less Soil.
     * When the Pod Rate is low, Beanstalk issues more Soil.
     */
    function setSoilAbovePeg(uint256 newHarvestable, uint256 caseId) internal {
        uint256 newSoil = newHarvestable.mul(100).div(100 + s.w.t);
        if (caseId >= 24) {
            newSoil = newSoil.mul(SOIL_COEFFICIENT_HIGH).div(C.PRECISION); // high podrate
        } else if (caseId < 8) {
            newSoil = newSoil.mul(SOIL_COEFFICIENT_LOW).div(C.PRECISION); // low podrate
        }
        setSoil(newSoil);
    }

    
    function setSoil(uint256 amount) internal {
        s.f.soil = amount.toUint128();
        emit Soil(s.season.current, amount.toUint128());
    }
}