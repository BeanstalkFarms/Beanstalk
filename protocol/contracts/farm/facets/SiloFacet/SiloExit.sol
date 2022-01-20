/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../../interfaces/IWETH.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/LibCheck.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibMarket.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Silo Exit
**/
contract SiloExit {

    AppStorage internal s;

    using SafeMath for uint256;
    using SafeMath for uint32;

    /**
     * Contracts
    **/

    function weth() public view returns (IWETH) {
        return IWETH(s.c.weth);
    }

    /**
     * Silo
    **/

    function totalStalk() public view returns (uint256) {
        return s.s.stalk;
    }

    function totalRoots() public view returns(uint256) {
        return s.s.roots;
    }

    function totalSeeds() public view returns (uint256) {
        return s.s.seeds;
    }

    function totalFarmableBeans() public view returns (uint256) {
        return s.si.beans.add(s.v1SI.beans).add(s.v2SIBeans);
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds.add(balanceOfFarmableBeans(account).mul(C.getSeedsPerBean()));
    }

    function balanceOfStalk(address account) public view returns (uint256) {
        return s.a[account].s.stalk.add(balanceOfFarmableStalk(account));
    }

    function balanceOfRoots(address account) public view returns (uint256) {
        return s.a[account].roots;
    }

    function balanceOfGrownStalk(address account) public view returns (uint256) {
        return LibSilo.stalkReward(s.a[account].s.seeds, season()-lastUpdate(account));
    }

    function balanceOfFarmableBeans(address account) public view returns (uint256 beans) {
        beans = beans.add(balanceOfFarmableBeansV1(account));
        beans = beans.add(balanceOfFarmableBeansV2(balanceOfUnclaimedRoots(account)));
        uint256 stalk = s.a[account].s.stalk.add(beans.mul(C.getStalkPerBean()));
        beans = beans.add(balanceOfFarmableBeansV3(account, stalk));
    }

    function balanceOfFarmableBeansV3(address account, uint256 accountStalk) public view returns (uint256 beans) {
        if (s.s.roots == 0) return 0;
        uint256 stalk = s.s.stalk.mul(balanceOfRoots(account)).div(s.s.roots);
        if (stalk <= accountStalk) return 0;
        beans = stalk.sub(accountStalk).div(C.getStalkPerBean());
        if (beans > s.si.beans) return s.si.beans;
        return beans;
    }

    function balanceOfFarmableBeansV2(uint256 roots) public view returns (uint256 beans) {
        if (s.unclaimedRoots == 0 || s.v2SIBeans == 0) return 0;
        beans = roots.mul(s.v2SIBeans).div(s.unclaimedRoots);
        if (beans > s.v2SIBeans) beans = s.v2SIBeans;
    }

    function balanceOfFarmableBeansV1(address account) public view returns (uint256 beans) {
        if (s.s.roots == 0 || s.v1SI.beans == 0 || lastUpdate(account) >= s.hotFix3Start) return 0;
        uint256 stalk = s.v1SI.stalk.mul(balanceOfRoots(account)).div(s.v1SI.roots);
        if (stalk <= s.a[account].s.stalk) return 0;
        beans = stalk.sub(s.a[account].s.stalk).div(C.getStalkPerBean());
        if (beans > s.v1SI.beans) return s.v1SI.beans;
        return beans;
    }

    function balanceOfUnclaimedRoots(address account) public view returns (uint256 uRoots) {
        uint256 sis = s.season.sis.sub(s.a[account].lastSIs);
        uRoots = balanceOfRoots(account).mul(sis);
        if (uRoots > s.unclaimedRoots) uRoots = s.unclaimedRoots;
    }

    function balanceOfFarmableStalk(address account) public view returns (uint256) {
        return balanceOfFarmableBeans(account).mul(C.getStalkPerBean());
    }

    function balanceOfFarmableSeeds(address account) public view returns (uint256) {
        return balanceOfFarmableBeans(account).mul(C.getSeedsPerBean());
    }

    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    function lastSupplyIncreases(address account) public view returns (uint32) {
        return s.a[account].lastSIs;
    }

    function supplyIncreases() external view returns (uint32) {
        return s.season.sis;
    }

    function unclaimedRoots() external view returns (uint256) {
        return s.unclaimedRoots;
    }

    function legacySupplyIncrease() external view returns (Storage.V1IncreaseSilo memory) {
        return s.v1SI;
    }

    /**
     * Season Of Plenty
    **/

    function lastSeasonOfPlenty() public view returns (uint32) {
        return s.sop.last;
    }

    function seasonsOfPlenty() public view returns (Storage.SeasonOfPlenty memory) {
        return s.sop;
    }

    function balanceOfEth(address account) public view returns (uint256) {
        if (s.sop.base == 0) return 0;
        return balanceOfPlentyBase(account).mul(s.sop.weth).div(s.sop.base);
    }
    
    function balanceOfPlentyBase(address account) public view returns (uint256) {
        uint256 plenty = s.a[account].sop.base;
        uint32 endSeason = s.a[account].lastSop;
        uint256 plentyPerRoot;
        uint256 rainSeasonBase = s.sops[s.a[account].lastRain];
        if (rainSeasonBase > 0) {
            if (endSeason == s.a[account].lastRain) {
                plentyPerRoot = rainSeasonBase.sub(s.a[account].sop.basePerRoot);
            } else {
                plentyPerRoot = rainSeasonBase.sub(s.sops[endSeason]);
                endSeason = s.a[account].lastRain;
            }
            if (plentyPerRoot > 0) plenty = plenty.add(plentyPerRoot.mul(s.a[account].sop.roots));
        }

        if (s.sop.last > lastUpdate(account)) {
            plentyPerRoot = s.sops[s.sop.last].sub(s.sops[endSeason]);
            plenty = plenty.add(plentyPerRoot.mul(balanceOfRoots(account)));
        }
        return plenty;
    }

    function balanceOfRainRoots(address account) public view returns (uint256) {
        return s.a[account].sop.roots;
    }

    /**
     * Governance
    **/

    function votedUntil(address account) public view returns (uint32) {
        if (voted(account)) {
            return s.a[account].votedUntil;
        }
        return 0;
    }

    function proposedUntil(address account) public view returns (uint32) {
        return s.a[account].proposedUntil;
    }

    function voted(address account) public view returns (bool) {
        if (s.a[account].votedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                uint32 activeBip = s.g.activeBips[i];
                if (s.g.voted[activeBip][account]) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Migration
    **/

    function balanceOfMigrationRoots(address account) internal view returns (uint256) {
        return balanceOfMigrationStalk(account).mul(C.getRootsBase());
    }

    function balanceOfMigrationStalk(address account) private view returns (uint256) {
        return s.a[account].s.stalk.add(LibSilo.stalkReward(s.a[account].s.seeds, s.bip0Start-lastUpdate(account)));
    }

    /**
     * Internal
    **/

    function season() internal view returns (uint32) {
        return s.season.current;
    }

}
