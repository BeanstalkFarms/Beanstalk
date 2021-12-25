/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibBeanSilo.sol";
import "../../../libraries/Decimal.sol";
import "../../../interfaces/ISeed.sol";
import "../../AppStorage.sol";
import "./SiloExit.sol";

/**
 * @author Publius
 * @title Silo Entrance
**/
contract UpdateSilo is SiloExit{

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    /**
     * Update
    **/

    function updateSilo(address account, uint256 unwrap_seed_amount, uint256 unwrap_stalk_amount, bool update_silo) public payable {
        if (!update_silo) {
		// Code for light update silo
	}
	else {
		uint32 update = lastUpdate(account);
	// convertSeeds(account);
        if (update >= LibSilo.season()) return;
        uint256 grownStalk;
        if (s.a[account].s.seeds > 0) grownStalk = balanceOfGrownStalk(account);
        if (s.a[account].roots > 0) {
            farmSops(account, update);
            farmBeans(account, update);
        } else if (s.a[account].roots == 0) {
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

    function farmBeans(address account, uint32 update, uint256 unwrap_seed_amount, uint256 unwrap_stalk_amount) private {
        if (s.a[account].lastSIs < s.season.sis) {
            farmLegacyBeans(account, update, unwrap_seed_amount, unwrap_stalk_amount);
        }

        uint256 accountStalk = s.a[account].s.stalk;
        uint256 beans = balanceOfFarmableBeansV3(account, accountStalk);
        if (beans > 0) {
            s.si.beans = s.si.beans.sub(beans);
            uint256 seeds = beans.mul(C.getSeedsPerBean());
	        uint256 stalk = beans.mul(C.getStalkPerBean());
            Account.State storage a = s.a[account];
	    seed().transfer(account, seeds);
            s.a[account].s.stalk = accountStalk.add(beans.mul(C.getStalkPerBean()));
            LibBeanSilo.addBeanDeposit(account, season(), beans);
            LibStalk._transfer(LibStalk._msgSender(), account, beans.mul(C.getStalkPerBean()));            

	    // if (unwrap_seed_amount > 0) {
		//     if (unwrap_seed_amount > seeds.add(a.s.seeds)) {
		// 	    seed().transfer(account, seeds.add(a.s.seeds));
		// 	    s.a[account].s.seeds = 0;
		//     }
		//     else {
		// 	    seed().transfer(account, unwrap_seed_amount);
		// 	    if (unwrap_seed_amount > seeds) s.a[account].s.seeds = s.a[account].s.seeds.sub(unwrap_seed_amount.sub(seeds));
		// 	    else s.a[account].s.seeds = s.a[account].s.seeds.add(seeds.sub(unwrap_seed_amount));
		//     }
	    // }
	    // else s.a[account].s.seeds = a.s.seeds.add(seeds);

	    // if (unwrap_stalk_amount > 0) {
		//     if (unwrap_stalk_amount > stalk.add(a.s.stalk)) {
        //                     LibStalk._transfer(address(this), account, stalk.add(a.s.stalk));
        //                     s.a[account].s.stalk = 0;
        //             }
        //             else {
        //                     LibStalk._transfer(address(this), account, unwrap_stalk_amount);
        //                     if (unwrap_stalk_amount > stalk) s.a[account].s.stalk = s.a[account].s.stalk.sub(unwrap_stalk_amount.sub(stalk));
        //                     else s.a[account].s.stalk = s.a[account].s.stalk.add(stalk.sub(unwrap_stalk_amount));
        //             }
	    // }
	    // else s.a[account].s.stalk = accountStalk.add(stalk);

        //     addBeanDeposit(account, season(), beans);
        }
    }

    function farmLegacyBeans(address account, uint32 update, uint256 unwrap_seed_amount, uint256 unwrap_stalk_amount) private {
        uint256 beans;
        if (update < s.hotFix3Start) {
            beans = balanceOfFarmableBeansV1(account);
            if (beans > 0) s.v1SI.beans = s.v1SI.beans.sub(beans);
        }

        uint256 unclaimedRoots = balanceOfUnclaimedRoots(account);
        uint256 beansV2 = balanceOfFarmableBeansV2(unclaimedRoots);
        beans = beans.add(beansV2);
        if (beansV2 > 0) s.v2SIBeans = s.v2SIBeans.sub(beansV2);
        s.unclaimedRoots = s.unclaimedRoots.sub(unclaimedRoots);
        s.a[account].lastSIs = s.season.sis;

        uint256 seeds = beans.mul(C.getSeedsPerBean());
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);
        s.a[account].s.stalk = s.a[account].s.stalk.add(beans.mul(C.getStalkPerBean()));
        LibBeanSilo.addBeanDeposit(account, season(), beans);
        uint256 stalk = beans.mul(C.getStalkPerBean());
        Account.State storage a = s.a[account];

    //     if (unwrap_seed_amount > 0) {
    //             if (unwrap_seed_amount > seeds.add(a.s.seeds)) {
    //                     seed().transfer(account, seeds.add(a.s.seeds));
    //                     s.a[account].s.seeds = 0;
    //             }
    //             else {
    //                     seed().transfer(account, unwrap_seed_amount);
    //                     if (unwrap_seed_amount > seeds) s.a[account].s.seeds = s.a[account].s.seeds.sub(unwrap_seed_amount.sub(seeds));
    //                     else s.a[account].s.seeds = s.a[account].s.seeds.add(seeds.sub(unwrap_seed_amount));
    //             }
	// }
    //     else s.a[account].s.seeds = a.s.seeds.add(seeds);

    //     if (unwrap_stalk_amount > 0) {
    //             if (unwrap_stalk_amount > stalk.add(a.s.stalk)) {
    //                     LibStalk._transfer(address(this), account, stalk.add(a.s.stalk));
    //                     s.a[account].s.stalk = 0;
    //              }
    //              else {
    //                     LibStalk._transfer(address(this), account, unwrap_stalk_amount);
    //                     if (unwrap_stalk_amount > stalk) s.a[account].s.stalk = s.a[account].s.stalk.sub(unwrap_stalk_amount.sub(stalk));
    //                     else s.a[account].s.stalk = s.a[account].s.stalk.add(stalk.sub(unwrap_stalk_amount));
    //              }
    //     }
    //     else s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);
    //     addBeanDeposit(account, season(), beans);
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

    function wrapStalk(address account, uint256 wrap_stalk_amount) external {
        if (s.stalkToken._balances[account] > 0) {
            if (s.stalkToken._balances[account] > wrap_stalk_amount) {
                LibStalk._transfer(account, address(this), wrap_stalk_amount);
                s.a[account].s.stalk = s.a[account].s.stalk.add(wrap_stalk_amount);
		s.s.stalk = s.s.stalk.add(wrap_stalk_amount);
            }
            else {
                s.a[account].s.stalk = s.a[account].s.stalk.add(s.stalkToken._balances[account]);
		s.s.stalk = s.s.stalk.add(s.stalkToken._balances[account]);
                LibStalk._transfer(account, address(this), s.stalkToken._balances[account]);
            }
        }
    }

    function unwrapStalk(address account, uint256 unwrap_stalk_amount) private {
        if (s.a[account].s.stalk > 0) {
            if (s.a[account].s.stalk > unwrap_stalk_amount) {
                    LibStalk._transfer(address(this), account, unwrap_stalk_amount);
                    s.a[account].s.stalk = s.a[account].s.stalk.sub(unwrap_stalk_amount);
		    s.s.stalk = s.s.stalk.sub(unwrap_stalk_amount);
            }
            else {
                    LibStalk._transfer(address(this), account, s.a[account].s.stalk);
                    s.a[account].s.stalk = 0;
		    s.s.stalk = s.s.stalk.sub(s.a[account].s.stalk);
            }
        }
    }

     function wrapSeeds(address account, uint256 wrap_seed_amount) external {
        if (seed().balanceOf(account) > 0) {
            if (seed().balanceOf(account) > wrap_seed_amount) {
                seed().transferFrom(account, address(this), wrap_seed_amount);
                s.a[account].s.seeds = s.a[account].s.seeds.add(wrap_seed_amount);
		s.s.seeds = s.s.seeds.add(wrap_seed_amount);
            }
            else {
                s.a[account].s.seeds = s.a[account].s.seeds.add(seed().balanceOf(account));
		s.s.seeds = s.s.seeds.add(seed().balanceOf(account));
                seed().transferFrom(account, address(this), seed().balanceOf(account));
            }
        }
    }

    function unwrapSeeds(address account, uint256 unwrap_seed_amount) private {
        if (s.a[account].s.seeds > 0) {
            if (s.a[account].s.seeds > unwrap_seed_amount) {
                    seed().transfer(account, unwrap_seed_amount);
                    s.a[account].s.seeds = s.a[account].s.seeds.sub(unwrap_seed_amount);
		    s.s.seeds = s.s.seeds.sub(unwrap_seed_amount);
            }
            else {
                    seed().transfer(account, s.a[account].s.seeds);
                    s.a[account].s.seeds = 0;
		    s.s.seeds = s.s.seeds.sub(s.a[account].s.seeds);
            }
        }
    }
}
