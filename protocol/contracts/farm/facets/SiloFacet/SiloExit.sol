/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./SiloInternal.sol";
import "../../../C.sol";
import "../../../interfaces/IWETH.sol";

/**
 * @author Publius
 * @title Silo Exit
**/
contract SiloExit is SiloInternal {

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

    function totalStalk() public view returns(uint256) {
        return s.s.stalk;
    }

    function totalSeeds() public view returns(uint256) {
        return s.s.seeds;
    }

    function balanceOfStalk(address account) public view returns (uint256) {
        return s.a[account].s.stalk.add(
            balanceOfRewardedStalk(account)
        ).add(
            balanceOfIncreaseStalk(account)
        );
    }

    function balanceOfSeeds(address account) public view returns (uint256) {
        return s.a[account].s.seeds.add(balanceOfIncrease(account).mul(C.getSeedsPerBean()));
    }

    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    function balanceOfRewardedStalk(address account) public view returns (uint256) {
        return stalkReward(s.a[account].s.seeds, season()-lastUpdate(account));
    }

    /**
     * Supply Increase
    **/

    function lastSupplyIncrease() public view returns (uint32) {
        return s.si.lastSupplyIncrease;
    }

    function previousSupplyIncrease(uint32 _s) public view returns (uint32) {
        return s.seasons[_s].next;
    }

    function supplyIncreases() public view returns (Storage.IncreaseSilo memory) {
        return s.si;
    }

    function balanceOfIncreaseStalk(address account) public view returns (uint256) {
        if (lastSupplyIncrease() <= lastUpdate(account) || s.si.increaseBase == 0) return 0;
        IncreaseBases memory b = increaseBasesForAccount(account);
        uint256 increase = b.increaseBase.mul(s.si.increase).div(s.si.increaseBase);
        return increase.mul(10000).add(balanceOfRewardedIncreaseStalk(b.stalkBase, b.increaseBase));
    }

    function balanceOfIncrease(address account) public view returns (uint256) {
        if (lastSupplyIncrease() <= lastUpdate(account) || s.si.increaseBase == 0) return 0;
        IncreaseBases memory b = increaseBasesForAccount(account);
        return b.increaseBase.mul(s.si.increase).div(s.si.increaseBase);
    }

    /**
     * Season Of Plenty
    **/

    function lastSeasonOfPlenty() public view returns (uint32) {
        return s.sop.last;
    }

    function nextSeasonOfPlenty(uint32 _s) public view returns (uint32) {
        return s.seasons[_s].next;
    }

    function seasonsOfPlenty() public view returns (Storage.SeasonOfPlenty memory) {
        return s.sop;
    }

    function balanceOfRainStalk(address account) public view returns (uint256) {
        return s.a[account].sop.stalk;
    }

    function balanceOfEth(address account) public view returns (uint256) {
        if (s.sop.base == 0) return 0;
        return balanceOfPlentyBase(account).mul(s.sop.weth).div(s.sop.base);
    }

    function balanceOfPlentyBase(address account) public view returns (uint256) {
        IncreaseBases memory b = increaseBasesForAccount(account);
        return plentyBaseForStalk(account).add(b.plentyBase).add(s.a[account].sop.base);
    }

    /**
     * Governance
    **/

    function lockedUntil(address account) public view returns (uint32) {
        if (locked(account)) {
            return s.a[account].lockedUntil;
        }
        return 0;
    }

    function locked(address account) public view returns (bool) {
        if (s.a[account].lockedUntil >= season()) {
            for (uint256 i = 0; i < s.g.activeBips.length; i++) {
                    uint32 activeBip = s.g.activeBips[i];
                    if (s.g.voted[activeBip][account]) {
                        return true;
                    }
            }
        }
        return false;
    }

}
