/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibSafeMath32.sol";
import "./Oracle.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Sun
 **/
contract Sun is Oracle {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event Reward(uint256 toField, uint256 toSilo, uint256 toBarnRaise);
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
        uint256 newBarnRaise;
        C.bean().mint(address(this), newSupply);
        if (s.season.barnRaising) {
            newBarnRaise = rewardToBarnRaise(newSupply);
            newSupply = newSupply.sub(newBarnRaise);
        }
        if (s.f.harvestable < s.f.pods) {
            newHarvestable = rewardToHarvestable(newSupply);
            newSupply = newSupply.sub(newHarvestable);
        }
        rewardToSilo(newSupply);
        emit Reward(newHarvestable, newSupply, newBarnRaise);
        setSoil(newHarvestable.mul(100).div(100 + s.w.yield));
    }

    function rewardToBarnRaise(uint256 amount)
        internal
        returns (uint256 brNewBeans)
    {
        uint256 brRemainingBeans = uint256(s.brOwedBeans - s.brPaidBeans); // Note: SafeMath is redundant here.
        brNewBeans = amount.div(C.getBarnRaiseDenominator());
        if (brRemainingBeans < brNewBeans) {
            brNewBeans = brRemainingBeans;
            s.season.barnRaising = false;
        }
        s.brPaidBeans = s.brPaidBeans + brNewBeans; // Note: SafeMath is redundant here.
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
