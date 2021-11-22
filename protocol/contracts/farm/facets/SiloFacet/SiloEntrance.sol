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
        uint256 farmableStalk;
        uint32 update = lastUpdate(account);
        if (update > 0 && update <= s.bip0Start) update = migrateBip0(account);
        if (s.a[account].s.seeds > 0) farmableStalk = balanceOfGrownStalk(account);
        if (s.a[account].roots > 0 && update < season()) {
            farmSops(account, update);
            farmBeans(account, update);
        } else if (s.a[account].roots == 0) s.a[account].lastSop = s.r.start;
        if (farmableStalk > 0) incrementBalanceOfStalk(account, farmableStalk);
        s.a[account].lastSIs = s.season.sis;
        s.a[account].lastUpdate = season();
    }

    function migrateBip0(address account) private returns (uint32) {
        uint32 update = s.bip0Start;

        s.a[account].lastUpdate = update;
        s.a[account].roots = balanceOfMigrationRoots(account);

        delete s.a[account].sop;
        delete s.a[account].lastSop;
        delete s.a[account].lastRain;

        return update;
    }

    function farmBeans(address account, uint256 update) private {
        uint256 unclaimedRoots = balanceOfUnclaimedRoots(account);
        uint256 beans = balanceOfFarmableBeansFromUnclaimedRoots(unclaimedRoots);
        if (beans > 0) {
            s.si.beans = s.si.beans.sub(beans);
            s.unclaimedRoots = s.unclaimedRoots.sub(unclaimedRoots);
        }
        if (update > 0 && update < s.hotFix3Start) {
            uint256 depBeans = balanceOfLegacyFarmableBeans(account);
            if (depBeans > 0) {
                beans = beans.add(depBeans);
                s.legSI.beans = s.legSI.beans.sub(depBeans);
            }
        }
        if (beans > 0) {
            uint256 stalk = balanceOfGrownFarmableStalk(account, beans);
            uint256 seeds = beans.mul(C.getSeedsPerBean());
            uint32 _s = uint32(stalk.div(seeds));
            if (_s >= season()) _s = season()-1;
            stalk = seeds.mul(_s);
            _s = season() - _s;

            Account.State storage a = s.a[account];
            s.si.stalk = s.si.stalk.sub(stalk);
            a.s.seeds = a.s.seeds.add(seeds);
            a.s.stalk = a.s.stalk.add(beans.mul(C.getStalkPerBean())).add(stalk);

            addBeanDeposit(account, _s, beans);
        }
    }

    function farmSops(address account, uint32 update) internal {
        if (s.sop.last > update || s.sops[s.a[account].lastRain] > 0) {
            s.a[account].sop.base = balanceOfPlentyBase(account);
            s.a[account].lastSop = s.sop.last;
        }
        if (s.r.raining) {
            if (s.r.start > update) {
                s.a[account].lastRain = s.r.start;
                s.a[account].sop.roots = s.a[account].roots;
            }
            if (s.sop.last == s.r.start) s.a[account].sop.basePerRoot = s.sops[s.sop.last];
        } else if (s.a[account].lastRain > 0) {
            s.a[account].lastRain = 0;
        }
    }

    /**
     * Silo
    **/

    function depositSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        incrementBalanceOfStalk(account, stalk);
        incrementBalanceOfSeeds(account, seeds);
    }

    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
    }

    function incrementBalanceOfStalk(address account, uint256 stalk) internal {
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(totalStalk());

        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        incrementBipRoots(account, roots);
    }

    function withdrawSiloAssets(address account, uint256 seeds, uint256 stalk) internal {
        decrementBalanceOfStalk(account, stalk);
        decrementBalanceOfSeeds(account, seeds);
    }

    function decrementBalanceOfSeeds(address account, uint256 seeds) internal {
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
    }

    function decrementBalanceOfStalk(address account, uint256 stalk) internal {
        if (stalk == 0) return;
        uint256 roots = s.a[account].roots.mul(stalk).sub(1).div(s.a[account].s.stalk).add(1);

        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
    }

    function addBeanDeposit(address account, uint32 _s, uint256 amount) internal {
        s.a[account].bean.deposits[_s] += amount;
        emit BeanDeposit(account, _s, amount);
    }

    function incrementDepositedBeans(uint256 amount) internal {
        s.bean.deposited = s.bean.deposited.add(amount);
    }

    modifier notLocked(address account) {
        require(!(locked(account)),"locked");
        _;
    }

    function updateBalanceOfRainStalk(address account) internal {
        if (!s.r.raining) return;
        if (s.a[account].roots < s.a[account].sop.roots) {
            s.r.roots = s.r.roots.sub(s.a[account].sop.roots.sub(s.a[account].roots));
            s.a[account].sop.roots = s.a[account].roots;
        }
    }

    function incrementBipRoots(address account, uint256 roots) internal {
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 bip = s.g.activeBips[i];
                if (s.g.voted[bip][account]) s.g.bips[bip].roots = s.g.bips[bip].roots.add(roots);
            }
        }
    }

}
