/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./Life.sol";
import "../../../libraries/LibInternal.sol";

/**
 * @author Publius
 * @title Silo
**/
contract Silo is Life {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    uint256 private constant BASE = 1e18;
    uint256 private constant BIG_BASE = 1e24;

    /**
     * Getters
    **/

    function resetBase(uint32 _s) external view returns (Season.ResetBases memory) {
        return s.rbs[_s];
    }

    function seasonIncrease(uint32 _s) external view returns (Season.State memory) {
        return s.seasons[_s];
    }

    function seasonOfPlenty(uint32 _s) external view returns (Season.SeasonOfPlenty memory) {
        return s.sops[_s];
    }

    function paused() public view returns (bool) {
        return s.paused;
    }

    /**
     * Internal
    **/

    // Silo

    function stepSilo(uint256 amount) internal {
      rewardSupplyIncreaseStalk();
      rewardBeans(amount);
      rewardStalk();
      rewardSeeds(amount);
    }

    function rewardSupplyIncreaseStalk() private {
        s.si.stalk = s.si.stalk.add(s.si.increase.mul(C.getSeedsPerBean()));
    }

    function rewardStalk() private {
        s.s.stalk = s.s.stalk.add(s.s.seeds);
    }

    function rewardSeeds(uint256 amount) private {
        if (amount>0) s.s.seeds = s.s.seeds.add(amount.mul(C.getSeedsPerBean()));
    }

    function rewardBeans(uint256 amount) private {
        if (amount == 0 || s.s.stalk == 0) return;
        s.bean.deposited = s.bean.deposited.add(amount);

        // Calculate claimed and unclaimed stalk
        uint256 newStalk = amount.mul(10000);
        uint256 unclaimedStalk = s.si.stalk.sub(s.si.increase.mul(C.getSeedsPerBean()));
        uint256 claimedStalk = s.s.stalk.sub(unclaimedStalk);

        // Award beans + stalk to unclaimed stalk pool
        if (unclaimedStalk > 0) {
            uint256 increaseForUnclaimed = unclaimedStalk.mul(amount).div(s.s.stalk);
            s.si.increase = s.si.increase.add(increaseForUnclaimed);
            s.si.stalk = s.si.stalk.add(increaseForUnclaimed.mul(10000));
            amount = amount.sub(increaseForUnclaimed);
        }
        uint256 stalk = amount.mul(10000);

        // Reset bases if needed
        resetBases(amount, claimedStalk);

        // Award beans to claimed stalk holders
        uint256 base;
        if (s.si.increase == 0) base = amount.mul(BASE);
        else base = amount.mul(s.si.increaseBase).div(s.si.increase);
        s.si.increase = s.si.increase.add(amount);
        uint256 basePerStalk = base.div(claimedStalk);
        base = basePerStalk.mul(claimedStalk);
        s.si.increaseBase = s.si.increaseBase.add(base);
        s.seasons[season()].increaseBase = basePerStalk;

        // Award stalk to claimed stalk holders
        if (s.si.stalk == 0) base = stalk.mul(BASE);
        else base = stalk.mul(s.si.stalkBase).div(s.si.stalk);
        s.si.stalk = s.si.stalk.add(stalk);
        basePerStalk = base.div(claimedStalk);
        base = basePerStalk.mul(claimedStalk);
        s.si.stalkBase = s.si.stalkBase.add(base);
        s.seasons[season()].stalkBase = basePerStalk;

        // Update total state
        s.s.stalk = s.s.stalk.add(newStalk);
        s.seasons[season()].next = s.si.lastSupplyIncrease;
        s.si.lastSupplyIncrease = season();
    }

    function resetBases(uint256 amount, uint256 claimedStalk) private {
        if (s.si.increaseBase > 0 && amount.mul(s.si.increaseBase).div(s.si.increase) < claimedStalk) {
            uint256 newIncreaseBase = (claimedStalk.mul(s.si.increase).sub(1)).div(amount).add(1);
            s.rbs[season()].increaseMultiple =    (newIncreaseBase.sub(1)).div(s.si.increaseBase).add(1);
            s.si.increaseBase = s.si.increaseBase.mul(s.rbs[season()].increaseMultiple);
        }
        if (s.si.stalkBase > 0 && amount.mul(10000).mul(s.si.stalkBase).div(s.si.stalk) < claimedStalk) {
            uint256 newStalkBase = (claimedStalk.mul(s.si.stalk).sub(1)).div(amount.mul(10000)).add(1);
            s.rbs[season()].stalkMultiple = (newStalkBase.sub(1)).div(s.si.stalkBase).add(1);
            s.si.stalkBase = s.si.stalkBase.mul(s.rbs[season()].stalkMultiple);
        }
    }

    // Season of Plenty

    function rewardEther(uint256 amount) internal {
        uint256 base;
        uint256 baseToUnclaimed = 0;
        uint256 basePerStalk;

        // Reset bases if needed
        resetSOPBases(amount);

        if (s.sop.base == 0) base = amount.mul(BIG_BASE);
        else base = amount.mul(s.sop.base).div(s.sop.weth);

        // Award ether to unclaimed stalk pool
        if (s.r.stalkBase > 0) {
            baseToUnclaimed = base.mul(s.r.increaseStalk).div(s.r.stalk.add(s.r.increaseStalk));
            basePerStalk = baseToUnclaimed.div(s.r.stalkBase);
            baseToUnclaimed = basePerStalk.mul(s.r.stalkBase);
            s.sops[season()].increaseBase = basePerStalk;
        }

        // Award ether to claimed stalk holders
        uint256 baseToClaimed = base.sub(baseToUnclaimed);
        basePerStalk = baseToClaimed.div(s.r.stalk);
        baseToClaimed = basePerStalk.mul(s.r.stalk);
        s.sops[season()].base = basePerStalk;

        // Update total state
        s.sop.weth = s.sop.weth.add(amount);
        s.sop.base = s.sop.base.add(baseToClaimed).add(baseToUnclaimed);
        if (baseToClaimed > 0 || baseToUnclaimed > 0) {
            s.sops[season()].next = s.sop.last;
            s.sops[season()].rainSeason = s.r.start;
            s.sop.last = season();
        }
    }

    function resetSOPBases(uint256 amount) private {
        if (s.sop.base > 0) {
            uint256 toUnclaimed = amount.mul(s.r.increaseStalk).div(s.r.stalk.add(s.r.increaseStalk));

            // Reset sop base for unclaimed if needed
            if (toUnclaimed > 0 &&
                toUnclaimed.mul(s.sop.base).div(s.sop.weth) < s.r.stalkBase) {
                resetSOPBase((s.r.stalkBase.mul(s.sop.weth).sub(1)).div(toUnclaimed).add(1));
            }

            // Reset sop base for claimed if needed
            if (amount > toUnclaimed &&
                amount.sub(toUnclaimed).mul(s.sop.base).div(s.sop.weth) < s.r.stalk) {
                uint256 toClaimed = amount.sub(toUnclaimed);
                resetSOPBase((s.r.stalk.mul(s.sop.weth).sub(1)).div(toClaimed).add(1));
            }
        }
    }

    function resetSOPBase(uint256 newBase) private {
        uint256 multiple = (newBase.sub(1)).div(s.sop.base).add(1);
        if (s.sop.base.mul(multiple) < 1e60) {
            s.sop.base = s.sop.base.mul(multiple);
            s.rbs[season()].sopMultiple = s.rbs[season()].sopMultiple == 0 ?
                multiple :
                s.rbs[season()].sopMultiple.mul(multiple);
        }
    }

    // Governance

    function stepGovernance() internal {
        for (uint256 i; i < s.g.activeBips.length; i++) {
            uint32 bip = s.g.activeBips[i];
            if (season() >= s.g.bips[bip].start.add(s.g.bips[bip].period)) {
                endBip(bip, i);
                i--;
            }
        }
    }

    function endBip(uint32 bipId, uint256 i) private {
        s.g.bips[bipId].timestamp = uint128(block.timestamp);
        s.g.bips[bipId].stalk = LibInternal.stalkFor(bipId);

        delete s.g.bips[bipId].increaseBase;
        delete s.g.bips[bipId].stalkBase;
        delete s.g.bips[bipId].seeds;

        s.g.bips[bipId].updated = season();
        s.g.bips[bipId].endTotalStalk = s.s.stalk;

        if (i < s.g.activeBips.length-1)
            s.g.activeBips[i] = s.g.activeBips[s.g.activeBips.length-1];
        s.g.activeBips.pop();
    }

}
