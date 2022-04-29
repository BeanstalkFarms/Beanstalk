/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./SiloExit.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract UpdateSilo is SiloExit {

    using SafeMath for uint256;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status = 1;

    /**
     * Update
    **/

    function updateSilo(address account) public payable {
        uint32 update = lastUpdate(account);
        if (update >= season()) return;
        uint256 grownStalk;
        if (s.a[account].s.seeds > 0) grownStalk = balanceOfGrownStalk(account);
        if (s.a[account].roots > 0) {
            farmSops(account, update);
            farmLegacyBeans(account, update);
            farmBeans(account, update);
        } else {
            s.a[account].lastSop = s.r.start;
            s.a[account].lastRain = 0;
            s.a[account].lastSIs = s.season.sis;
        }
        if (grownStalk > 0) LibSilo.incrementBalanceOfStalk(account, grownStalk);
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

    function farmBeans(address account, uint32 update) private {
        if (s.a[account].lastSIs < s.season.sis) {
            farmLegacyBeans(account, update);
        }

        uint256 accountStalk = s.a[account].s.stalk;
        uint256 beans = balanceOfFarmableBeansV3(account, accountStalk);
        if (beans > 0) {
            s.si.beans = s.si.beans.sub(beans);
            uint256 seeds = beans.mul(C.getSeedsPerBean());
            Account.State storage a = s.a[account];
            s.a[account].s.seeds = a.s.seeds.add(seeds);
            s.a[account].s.stalk = accountStalk.add(beans.mul(C.getStalkPerBean()));
            LibTokenSilo.addDeposit(account, C.beanAddress(), season(), beans, beans.mul(C.getStalkPerBean()));
        }
    }

    function farmLegacyBeans(address account, uint32 update) private {
        uint256 beans;
        if (update < s.hotFix3Start) {
            beans = balanceOfFarmableBeansV1(account);
            if (beans > 0) s.v1SI.beans = s.v1SI.beans.sub(beans);
        }

        uint256 unclaimedRoots = balanceOfUnclaimedRoots(account);
        uint256 beansV2 = balanceOfFarmableBeansV2(unclaimedRoots);
        beans = beans.add(beansV2);
        if (beansV2 > 0) s.v2SIBeans = s.v2SIBeans.sub(beansV2);
        s.unclaimedRoots = unclaimedRoots < s.unclaimedRoots ? s.unclaimedRoots - unclaimedRoots : 0;
        s.a[account].lastSIs = s.season.sis;

        uint256 seeds = beans.mul(C.getSeedsPerBean());
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
        s.a[account].s.stalk = s.a[account].s.stalk.add(beans.mul(C.getStalkPerBean()));
        LibTokenSilo.addDeposit(account, C.beanAddress(), season(), beans, beans.mul(C.getStalkPerBean()));
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

    modifier silo() {
        updateSilo(msg.sender);
        _;
    }
}
