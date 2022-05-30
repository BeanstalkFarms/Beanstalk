/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibSafeMath32.sol";
import "./Oracle.sol";
import "../../../C.sol";
import "../../../libraries/LibFertilizer.sol";

/**
 * @author Publius
 * @title Sun
 **/
contract Sun is Oracle {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event Reward(uint256 toField, uint256 toSilo, uint256 toFertilizer);
    event Soil(uint256 soil);

    /**
     * Sun Internal
     **/

    function stepSun(int256 deltaB) internal {
        if (deltaB > 0) rewardBeans(uint256(deltaB));
        else setSoil(uint256(-deltaB));
    }

    function rewardBeans(uint256 newSupply) internal {
        uint256 newHarvestable;
        uint256 newFertilizable;
        C.bean().mint(address(this), newSupply);
        if (s.season.fertilizing) {
            newFertilizable = rewardToFertilizer(newSupply);
            newSupply = newSupply.sub(newFertilizable);
        }
        if (s.f.harvestable < s.f.pods) {
            newHarvestable = rewardToHarvestable(newSupply);
            newSupply = newSupply.sub(newHarvestable);
        }
        rewardToSilo(newSupply);
        emit Reward(newHarvestable, newSupply, newFertilizable);
        setSoil(newHarvestable.mul(100).div(100 + s.w.yield));
    }

    function rewardToFertilizer(uint256 amount)
        internal
        returns (uint256 newFertilizable)
    {
        uint256 maxNewFertilizable = amount.div(C.getFertilizerDenominator());

        uint256 newBpf = maxNewFertilizable.div(s.activeFertilizer);
        uint256 oldTotalBpf = s.bpf;
        uint256 newTotalBpf = oldTotalBpf.add(newBpf);
        uint256 firstEndBpf = s.fFirst;

        while(newTotalBpf >= firstEndBpf) {
            newBpf = firstEndBpf.sub(oldTotalBpf);
            newFertilizable = newFertilizable.add(newBpf.mul(s.activeFertilizer));
            if (!LibFertilizer.pop()) {
                s.bpf = uint32(firstEndBpf);
                s.fertilizedIndex = s.fertilizedIndex.add(newFertilizable);
                require(s.fertilizedIndex == s.unfertilizedIndex, "Paid != owed");
                return newFertilizable;
            }
            newBpf = maxNewFertilizable.sub(newFertilizable).div(s.activeFertilizer);
            oldTotalBpf = firstEndBpf;
            newTotalBpf = oldTotalBpf.add(newBpf);
            firstEndBpf = s.fFirst;
        }

        s.bpf = uint32(newTotalBpf);
        newFertilizable = newFertilizable.add(newBpf.mul(s.activeFertilizer));
        s.fertilizedIndex = s.fertilizedIndex.add(newFertilizable);
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
        s.s.stalk = s.s.stalk.add(amount.mul(C.getStalkPerBean()));
        s.earnedBeans = s.earnedBeans.add(amount);
        s.siloBalances[C.beanAddress()].deposited = s
            .siloBalances[C.beanAddress()]
            .deposited
            .add(amount);
    }

    function setSoil(uint256 amount) internal {
        s.f.soil = amount;
        s.w.startSoil = amount;
        emit Soil(amount);
    }
}
