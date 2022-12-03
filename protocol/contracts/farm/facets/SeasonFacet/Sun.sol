/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Decimal.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../../libraries/LibSafeMath128.sol";
import "./Oracle.sol";
import "../../../C.sol";
import "../../../libraries/LibFertilizer.sol";

/**
 * @author Publius, Brean
 * @title Sun
 **/
contract Sun is Oracle {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;
    using LibSafeMath32 for uint32;
    using Decimal for Decimal.D256;

    event Reward(uint32 indexed season, uint256 toField, uint256 toSilo, uint256 toFertilizer);
    event Soil(uint32 indexed season, uint256 soil);

    /**
     * Sun Internal
     **/

    function stepSun(int256 deltaB, uint256 caseId) internal {
        if (deltaB > 0) {
            uint256 newHarvestable = rewardBeans(uint256(deltaB));
            setSoilAbovePeg(newHarvestable, caseId);
        }
        else setSoil(uint256(-deltaB));
    }

    function rewardBeans(uint256 newSupply) internal returns (uint256 newHarvestable) {
        uint256 newFertilized;
        C.bean().mint(address(this), newSupply);
        if (s.season.fertilizing) {
            newFertilized = rewardToFertilizer(newSupply);
            newSupply = newSupply.sub(newFertilized);
        }
        if (s.f.harvestable < s.f.pods) {
            newHarvestable = rewardToHarvestable(newSupply);
            newSupply = newSupply.sub(newHarvestable);
        }
        rewardToSilo(newSupply);
        emit Reward(s.season.current, newHarvestable, newSupply, newFertilized);
    }

    function rewardToFertilizer(uint256 amount)
        internal
        returns (uint256 newFertilized)
    {
        // 1/3 of new Beans being minted
        uint256 maxNewFertilized = amount.div(C.getFertilizerDenominator());

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
                s.bpf = uint128(firstEndBpf);
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
        s.bpf = uint128(newTotalBpf);
        newFertilized = newFertilized.add(newBpf.mul(s.activeFertilizer));
        s.fertilizedIndex = s.fertilizedIndex.add(newFertilized);
    }

    function rewardToHarvestable(uint256 amount)
        internal    
        returns (uint256 newHarvestable)
    {
        uint256 notHarvestable = s.f.pods - s.f.harvestable; // Note: SafeMath is redundant here.
        newHarvestable = amount.div(C.getHarvestDenominator());
        newHarvestable = newHarvestable > notHarvestable
            ? notHarvestable
            : newHarvestable;
        s.f.harvestable = s.f.harvestable.add(newHarvestable);
    }

    function rewardToSilo(uint256 amount) internal {
        uint256 seasonStalk = amount.mul(C.getStalkPerBean());
        s.s.stalk = s.s.stalk.add(seasonStalk);
        s.earnedBeans = s.earnedBeans.add(uint128(amount)); 
        s.newEarnedStalk = uint128(seasonStalk);
        s.siloBalances[C.beanAddress()].deposited = s
            .siloBalances[C.beanAddress()]
            .deposited
            .add(amount);
    }

    function setSoilAbovePeg(uint256 newHarvestable, uint256 caseId) internal {
        uint256 newSoil = newHarvestable.mul(100).div(100 + s.w.yield);
        if (caseId >= 24) newSoil = newSoil.mul(C.soilCoefficientHigh()).div(C.precision());
        else if (caseId < 8) newSoil = newSoil.mul(C.soilCoefficientLow()).div(C.precision());
        setSoil(newSoil);
    }

    function setSoil(uint256 amount) internal {
        s.f.soil = amount;
        s.w.startSoil = amount;
        emit Soil(s.season.current, amount);
    }
}
