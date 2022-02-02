/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/LibUserBalance.sol";
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
contract UpdateSilo is SiloExit {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    /**
     * Update
    **/

    function updateSilo(address account, bool toInternalBalance, bool lightUpdateSilo) public payable {
        // BIP-9 Migration for Internal Balances
        migrateBip9(account);

        uint32 update = lastUpdate(account);
        if (update >= LibSilo.season()) return;
        uint256 grownStalk;
        if (s.a[account].s.seeds.add(seed().balanceOf(account)) > 0) grownStalk = balanceOfGrownStalk(account);
        if (s.a[account].roots > 0) {
            farmSops(account, update);
            farmLegacyBeans(account, update);
	        if (!lightUpdateSilo) farmBeans(account, update);
	    
        } else if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.r.start;
            s.a[account].lastRain = 0;
            s.a[account].lastSIs = s.season.sis; //runs farmLegacyBeans
        }
        if (grownStalk > 0) LibSilo.incrementBalanceOfStalk(account, grownStalk, toInternalBalance);
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

    function migrateBip9(address account) private {
        if (s.a[account].s.stalk > 0) {
            s.internalTokenBalance[account][IERC20(address(this))] = s.a[account].s.stalk;
            delete s.a[account].s.stalk;

            s.internalTokenBalance[account][ISeed(s.seedContract)] = s.a[account].s.seeds;
            delete s.a[account].s.seeds;

            s.internalTokenBalance[account][IERC20(s.c.bean)] = s.a[account].wrappedBeans;
            delete s.a[account].wrappedBeans;
        }
    }

    function farmBeans(address account, uint32 update) private {
        uint256 beans = balanceOfFarmableBeansV3(account, s.a[account].s.stalk.add(balanceOf(account)));
        if (beans > 0) {
            s.si.beans = s.si.beans.sub(beans);
            uint256 seeds = beans.mul(C.getSeedsPerBean());
            uint256 stalk = beans.mul(C.getStalkPerBean());
	    seed().transfer(account, seeds);
            LibBeanSilo.addBeanDeposit(account, season(), beans);
            LibStalk.transfer(address(this), account, beans.mul(C.getStalkPerBean()));            
        }
    }

    function farmLegacyBeans(address account, uint32 update) private {
        if (s.a[account].lastSIs >= s.season.sis) return;
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

    function wrapStalk(uint256 wrap_stalk_amount) public {
        if (s.stalkToken.balances[msg.sender] > 0) {
            if (s.stalkToken.balances[msg.sender] > wrap_stalk_amount) {
                LibStalk.transfer(msg.sender, address(this), wrap_stalk_amount);
                s.a[msg.sender].s.stalk = s.a[msg.sender].s.stalk.add(wrap_stalk_amount);
            }
            else {
                s.a[msg.sender].s.stalk = s.a[msg.sender].s.stalk.add(s.stalkToken.balances[msg.sender]);
                LibStalk.transfer(msg.sender, address(this), s.stalkToken.balances[msg.sender]);
            }
        }
    }
    function unwrapStalk(uint256 unwrap_stalk_amount) public {
        if (s.a[msg.sender].s.stalk > 0) {
            if (s.a[msg.sender].s.stalk > unwrap_stalk_amount) {
                    LibStalk.transfer(address(this), msg.sender, unwrap_stalk_amount);
                    s.a[msg.sender].s.stalk = s.a[msg.sender].s.stalk.sub(unwrap_stalk_amount);
            }
            else {
                    LibStalk.transfer(address(this), msg.sender, s.a[msg.sender].s.stalk);
                    s.a[msg.sender].s.stalk = 0;
            }
        }
    }

     function wrapSeeds(uint256 wrap_seed_amount) public {
        if (seed().balanceOf(msg.sender) > 0) {
            if (seed().balanceOf(msg.sender) > wrap_seed_amount) {
                seed().transferFrom(msg.sender, address(this), wrap_seed_amount);
                s.a[msg.sender].s.seeds = s.a[msg.sender].s.seeds.add(wrap_seed_amount);
            }
            else {
                s.a[msg.sender].s.seeds = s.a[msg.sender].s.seeds.add(seed().balanceOf(msg.sender));
                seed().transferFrom(msg.sender, address(this), seed().balanceOf(msg.sender));
            }
        }
    }

    function unwrapSeeds(uint256 unwrap_seed_amount) public {
        if (s.a[msg.sender].s.seeds > 0) {
            if (s.a[msg.sender].s.seeds > unwrap_seed_amount) {
                    seed().transfer(msg.sender, unwrap_seed_amount);
                    s.a[msg.sender].s.seeds = s.a[msg.sender].s.seeds.sub(unwrap_seed_amount);
            }
            else {
                    seed().transfer(msg.sender, s.a[msg.sender].s.seeds);
                    s.a[msg.sender].s.seeds = 0;
            }
        }
    }
}
