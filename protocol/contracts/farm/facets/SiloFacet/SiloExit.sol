/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../ReentrancyGuard.sol";
import "../../../interfaces/IWETH.sol";
import "../../../interfaces/IBean.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Silo Exit
**/
contract SiloExit is ReentrancyGuard {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

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

    function totalEarnedBeans() public view returns (uint256) {
        return s.si.beans;
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds; // Earned Seeds do not earn Grown stalk, so we do not include them. 
    }

    function balanceOfStalk(address account) public view returns (uint256) {
        return s.a[account].s.stalk.add(balanceOfEarnedStalk(account)); // Earned Stalk earns Bean Mints, but Grown Stalk does not.
    }

    function balanceOfRoots(address account) public view returns (uint256) {
        return s.a[account].roots;
    }

    function balanceOfGrownStalk(address account) public view returns (uint256) {
        return LibSilo.stalkReward(s.a[account].s.seeds, season()-lastUpdate(account));
    }

    function balanceOfEarnedBeans(address account) public view returns (uint256 beans) {
        beans = _balanceOfEarnedBeans(account,  s.a[account].s.stalk);
    }

    function _balanceOfEarnedBeans(address account, uint256 accountStalk) internal view returns (uint256 beans) {
        if (s.s.roots == 0) return 0;
        uint256 stalk = s.s.stalk.mul(s.a[account].roots).div(s.s.roots);
        if (stalk <= accountStalk) return 0;
        beans = (stalk - accountStalk).div(C.getStalkPerBean()); // Note: SafeMath is redundant here.
        if (beans > s.si.beans) return s.si.beans;
        return beans;
    }

    function balanceOfEarnedStalk(address account) public view returns (uint256) {
        return balanceOfEarnedBeans(account).mul(C.getStalkPerBean());
    }

    function balanceOfEarnedSeeds(address account) public view returns (uint256) {
        return balanceOfEarnedBeans(account).mul(C.getSeedsPerBean());
    }

    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
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
     * Internal
    **/

    function season() internal view returns (uint32) {
        return s.season.current;
    }

}
