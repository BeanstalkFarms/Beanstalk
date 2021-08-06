/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./SiloExit.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract SiloEntrance is SiloExit {

    using SafeMath for uint256;

    event BeanDeposit(address indexed account, uint256 season, uint256 beans);

    /**
     * Update
    **/

    function updateSilo(address account) public payable {
        if (s.a[account].s.stalk > 0) {
            updateSop(account);
            uint256 beans = claimIncrease(account);
            rewardStalk(account);
            claimSeeds(account, beans);
        }
        s.a[account].lastUpdate = season();
    }

    function updateSop(address account) private {
        if (lastSeasonOfPlenty() > lastUpdate(account))
            s.a[account].sop.base = s.a[account].sop.base.add(plentyBaseForStalk(account));
        if (s.r.raining && s.r.start > lastUpdate(account))
            s.a[account].sop.stalk =
                s.a[account].s.stalk.add(s.a[account].s.seeds.mul(s.r.start-lastUpdate(account)-1));
    }

    function claimIncrease(address account) private returns (uint256) {
        if (lastSupplyIncrease() <= lastUpdate(account)) return 0;
        if (s.si.stalkBase == 0 || s.si.increaseBase == 0) return 0;

        IncreaseBases memory b = increaseBasesForAccount(account);
        uint256 _stalk;

        if (b.rainBase > 0) {
            _stalk = b.rainBase.mul(s.r.increaseStalk).div(s.r.stalkBase);
            s.r.increaseStalk = s.r.increaseStalk.sub(_stalk);
            s.r.stalkBase = s.r.stalkBase.sub(b.rainBase);
            s.r.stalk = s.r.stalk.add(_stalk);
            s.a[account].sop.stalk = s.a[account].sop.stalk.add(_stalk);
        }

        s.a[account].sop.base = s.a[account].sop.base.add(b.plentyBase);
        uint256 beans = b.increaseBase.mul(s.si.increase).div(s.si.increaseBase);
        uint256 rewardedStalk = balanceOfRewardedIncreaseStalk(b.stalkBase, b.increaseBase);
        _stalk = rewardedStalk.add(beans.mul(10000));
        if (beans > 0) rewardedStalk = depositIncrease(account, beans, rewardedStalk);

        updateVotedBipsIncrease(
            account,
            beans.mul(C.getSeedsPerBean()),
            _stalk.sub(rewardedStalk),
            b.increaseBase,
            b.stalkBase
        );

        s.si.stalkBase = s.si.stalkBase.sub(b.stalkBase);
        s.si.stalk = s.si.stalk.sub(_stalk).add(rewardedStalk);
        s.si.increaseBase = s.si.increaseBase.sub(b.increaseBase);
        s.si.increase = s.si.increase.sub(beans);
        s.a[account].s.stalk = s.a[account].s.stalk.add(_stalk).sub(rewardedStalk);
        return beans;
    }

    function depositIncrease(address account, uint256 beans, uint256 rewardedStalk)
        private
        returns (uint256)
    {
        uint32 rewardedSeason = uint32(rewardedStalk.div(beans.mul(C.getSeedsPerBean())));
        rewardedStalk = rewardedStalk.sub(uint256(rewardedSeason).mul(beans).mul(C.getSeedsPerBean()));
        rewardedSeason = season() - rewardedSeason;
        uint256 previousSeasonBeans = rewardedStalk.div(C.getSeedsPerBean());
        rewardedStalk = rewardedStalk.sub(previousSeasonBeans.mul(C.getSeedsPerBean()));
        addBeanDeposit(account, rewardedSeason, beans.sub(previousSeasonBeans));
        addBeanDeposit(account, rewardedSeason-1, previousSeasonBeans);
        return rewardedStalk;
    }

    function rewardStalk(address account) private {
        if (s.a[account].s.seeds > 0)
            s.a[account].s.stalk = s.a[account].s.stalk.add(balanceOfRewardedStalk(account));
    }

    function claimSeeds(address account, uint256 beans) private {
        s.a[account].s.seeds = s.a[account].s.seeds.add(beans.mul(C.getSeedsPerBean()));
    }

    /**
     * Silo
    **/

    function incrementBalanceOfStalk(address account, uint256 seeds, uint256 stalk) internal {
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);
    }

    function decrementBalanceOfStalk(address account, uint256 seeds, uint256 stalk) internal {
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);
    }

    function addBeanDeposit(address account, uint32 _s, uint256 amount) internal {
        s.a[account].bean.deposits[_s] += amount;
        emit BeanDeposit(account, _s, amount);
    }

    /**
     * Season of Plenty
    **/

    function updateBalanceOfRainStalk(address account) internal {
        if (!s.r.raining) return;
        if (s.a[account].s.stalk < s.a[account].sop.stalk) {
            s.r.stalk = s.r.stalk.sub(s.a[account].sop.stalk.sub(s.a[account].s.stalk));
            s.a[account].sop.stalk = s.a[account].s.stalk;
        }
    }

    /**
     * Governance
    **/

    function incrementBipStalk(address account, uint256 seeds, uint256 stalk) internal {
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) {
                    s.g.bips[bip].stalk = s.g.bips[bip].stalk.add(stalk);
                    s.g.bips[bip].seeds = s.g.bips[bip].seeds.add(seeds);
                }
            }
        }
    }

    function updateVotedBipsIncrease(
        address account,
        uint256 seeds,
        uint256 stalk,
        uint256 increaseBase,
        uint256 stalkBase
    )
        private
    {
        for (uint256 i = 0; i < s.g.activeBips.length; i++) {
            uint32 bip = s.g.activeBips[i];
            if (s.g.voted[bip][account]) {
                LibInternal.updateBip(bip);
                s.g.bips[bip].stalk = s.g.bips[bip].stalk.add(stalk);
                s.g.bips[bip].seeds = s.g.bips[bip].seeds.add(seeds);
                s.g.bips[bip].increaseBase = s.g.bips[bip].increaseBase.sub(increaseBase);
                s.g.bips[bip].stalkBase = s.g.bips[bip].stalkBase.sub(stalkBase);
            }
        }
    }

    modifier notLocked(address account) {
        require(!(locked(account)),"locked");
        _;
    }

}
