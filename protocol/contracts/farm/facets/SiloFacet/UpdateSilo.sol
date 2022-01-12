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
        if (LibUserBalance._getBalance(account, seed()) > 0) grownStalk = balanceOfGrownStalk(account);
        if (s.a[account].roots > 0) {
            farmSops(account, update);
            farmLegacyBeans(account, update);
	        if (!lightUpdateSilo) farmBeans(account, update, toInternalBalance);
        } else if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.r.start;
            s.a[account].lastRain = 0;
            s.a[account].lastSIs = s.season.sis;
        }
        if (grownStalk > 0) LibSilo.incrementBalanceOfStalk(account, grownStalk, toInternalBalance);
        s.a[account].lastUpdate = season();
    }

    function migrateBip9(address account) private {
        if (s.a[account].s.stalk > 0) {
            LibUserBalance._increaseInternalBalance(account, IERC20(address(this)), s.a[account].s.stalk);
            delete s.a[account].s.stalk;
        }
        if (s.a[account].s.seeds > 0) {
            LibUserBalance._increaseInternalBalance(account, ISeed(s.seedContract), s.a[account].s.seeds);
            delete s.a[account].s.seeds;
        }
        if (s.a[account].wrappedBeans > 0) {
            LibUserBalance._increaseInternalBalance(account, IBean(s.c.bean), s.a[account].wrappedBeans);
            delete s.a[account].wrappedBeans;
        }
    }

    function farmBeans(address account, uint32 update, bool toInternalBalance) private {
        uint256 beans = balanceOfFarmableBeansV3(account, LibUserBalance._getBalance(account, stalk()));
        if (beans > 0) {
            s.si.beans = s.si.beans.sub(beans);
            uint256 seeds = beans.mul(C.getSeedsPerBean());
            uint256 stalk = beans.mul(C.getStalkPerBean());
            if (toInternalBalance) {
                seed().transfer(account, seeds);
                LibStalk.transfer(address(this), account, beans.mul(C.getStalkPerBean()));
            } else {
                LibUserBalance._increaseInternalBalance(account, ISeed(s.seedContract), seeds);
                LibUserBalance._increaseInternalBalance(account, IERC20(address(this)), beans.mul(C.getStalkPerBean()));
            }

            LibBeanSilo.addBeanDeposit(account, season(), beans);
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
        uint256 stalk = beans.mul(C.getStalkPerBean());
        LibUserBalance._increaseInternalBalance(account, seed(), seeds);
        LibUserBalance._increaseInternalBalance(account, IERC20(address(this)), stalk);
        LibBeanSilo.addBeanDeposit(account, season(), beans);
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

    // function wrapStalk(uint256 wrap_stalk_amount) public {
    //     if (s.stalkToken.balances[msg.sender] > 0) {
    //         if (s.stalkToken.balances[msg.sender] > wrap_stalk_amount) {
    //             LibStalk.transfer(msg.sender, address(this), wrap_stalk_amount);
    //             LibUserBalance._increaseInternalBalance(msg.sender, stalk(), wrap_stalk_amount);
    //         }
    //         else {
	// 	LibUserBalance._increaseInternalBalance(msg.sender, stalk(), balanceOf(msg.sender));
    //             LibStalk.transfer(msg.sender, address(this), balanceOf(msg.sender));
    //         }
    //     }
    // }
    // function unwrapStalk(uint256 unwrap_stalk_amount) public {
    //     if (s.internalTokenBalance[msg.sender][stalk()] > 0) {
    //         if (s.internalTokenBalance[msg.sender][stalk()] > unwrap_stalk_amount) {
    //                 LibStalk.transfer(address(this), msg.sender, unwrap_stalk_amount);
	// 	    LibUserBalance._decreaseInternalBalance(msg.sender, stalk(), unwrap_stalk_amount, false);
    //         }
    //         else {
    //                 LibStalk.transfer(address(this), msg.sender, s.internalTokenBalance[msg.sender][stalk()]);
    //                 s.internalTokenBalance[msg.sender][stalk()] = 0;
    //         }
    //     }
    // }

    //  function wrapSeeds(uint256 wrap_seed_amount) public {
    //     if (seed().balanceOf(msg.sender) > 0) {
    //         if (seed().balanceOf(msg.sender) > wrap_seed_amount) {
    //             seed().transferFrom(msg.sender, address(this), wrap_seed_amount);
	// 	LibUserBalance._increaseInternalBalance(msg.sender, seed(), wrap_seed_amount);
    //         }
    //         else {
	// 	LibUserBalance._increaseInternalBalance(msg.sender, seed(), seed().balanceOf(msg.sender));
    //             seed().transferFrom(msg.sender, address(this), seed().balanceOf(msg.sender));
    //         }
    //     }
    // }

    // function unwrapSeeds(uint256 unwrap_seed_amount) public {
    //     if (s.internalTokenBalance[msg.sender][seed()] > 0) {
    //         if (s.internalTokenBalance[msg.sender][seed()] > unwrap_seed_amount) {
    //                 seed().transfer(msg.sender, unwrap_seed_amount);
	// 	    LibUserBalance._decreaseInternalBalance(msg.sender, seed(), unwrap_seed_amount, false);
    //         }
    //         else {
    //                 seed().transfer(msg.sender, s.internalTokenBalance[msg.sender][seed()]);
    //                 s.internalTokenBalance[msg.sender][seed()] = 0;
    //         }
    //     }
    // }
}
