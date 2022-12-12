/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../ReentrancyGuard.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../../libraries/LibSafeMath128.sol";
import "../../../C.sol";
import "../../../libraries/LibPRBMath.sol";
import "hardhat/console.sol";


/**
 * @author Publius, Brean
 * @title Silo Exit
 **/
contract SiloExit is ReentrancyGuard {
    using SafeMath for uint256;
    using LibPRBMath for uint256;
    using LibSafeMath128 for uint128;
    using LibSafeMath32 for uint32;

    struct AccountSeasonOfPlenty {
        uint32 lastRain;
        uint32 lastSop;
        uint256 roots;
        uint256 plentyPerRoot;
        uint256 plenty;
    }

    /**
     * Silo
     **/

    function totalStalk() public view returns (uint256) {
        return s.s.stalk;
    }

    function totalVestingStalk() public view returns (uint256) {
        return s.newEarnedStalk;
    }

    function totalRoots() public view returns (uint256) {
        return s.s.roots;
    }

    function totalSeeds() public view returns (uint256) {
        return s.s.seeds;
    }

    function totalEarnedBeans() public view returns (uint256) {
        return s.earnedBeans;
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

    function balanceOfGrownStalk(address account)
        public
        view
        returns (uint256)
    {
        return
            LibSilo.stalkReward(
                s.a[account].s.seeds,
                season() - lastUpdate(account)
            );
    }

    function balanceOfEarnedBeans(address account)
        public
        view
        returns (uint256 beans)
    {
        beans = _balanceOfEarnedBeans(account, s.a[account].s.stalk);
    }

    function _balanceOfEarnedBeans(address account, uint256 accountStalk)
        internal
        view
        returns (uint256 beans)
    {
        // There will be no Roots when the first deposit is made.
        if (s.s.roots == 0) return 0;
        // obtain the vesting stalk, based on how much time has elasped within a season. 
        // at t = 0, percentSeasonRemaining should be 1e18 (100%)
        // at t = 1800, percentSeasonRemaining should be 5e17 (50%)
        // at t = 3600, percentSeasonRemaining should be 0 (0%)
        uint256 percentSeasonRemaining = 
            1e18 - LibPRBMath.min((block.timestamp - s.season.timestamp) * 1e18 / 3600, 1e18); // safemath not needed
        // stalk vested = new earned stalk * % season remanining
        uint256 vestingEarnedStalk = uint256(s.newEarnedStalk).mul(percentSeasonRemaining).div(1e18);
        // Determine expected user Stalk based on Roots balance
        // userStalk / totalStalk = userRoots / totalRoots
        uint256 stalk = s.s.stalk.sub(vestingEarnedStalk).mulDiv(s.a[account].roots,s.s.roots, LibPRBMath.Rounding.Up);
        
        // Handle edge case caused by rounding
        if (stalk <= accountStalk) return 0;


        // Calculate Earned Stalk and convert to Earned Beans.
        beans = (stalk - accountStalk).div(C.getStalkPerBean()); // Note: SafeMath is redundant here.

        if (beans > s.earnedBeans) return s.earnedBeans;
        return beans;
    }

    function balanceOfEarnedStalk(address account)
        public
        view
        returns (uint256)
    {
        return balanceOfEarnedBeans(account).mul(C.getStalkPerBean());
    }

    function balanceOfEarnedSeeds(address account)
        public
        view
        returns (uint256)
    {
        return balanceOfEarnedBeans(account).mul(C.getSeedsPerBean());
    }

    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    /**
     * Season Of Plenty
     **/

    function lastSeasonOfPlenty() public view returns (uint32) {
        return s.season.lastSop;
    }

    function balanceOfPlenty(address account)
        public
        view
        returns (uint256 plenty)
    {
        Account.State storage a = s.a[account];
        plenty = a.sop.plenty;
        uint256 previousPPR;
        // If lastRain > 0, check if SOP occured during the rain period.
        if (s.a[account].lastRain > 0) {
            // if the last processed SOP = the lastRain processed season,
            // then we use the stored roots to get the delta.
            if (a.lastSop == a.lastRain) previousPPR = a.sop.plentyPerRoot;
            else previousPPR = s.sops[a.lastSop];
            uint256 lastRainPPR = s.sops[s.a[account].lastRain];

            // If there has been a SOP duing this rain sesssion since last update, process spo.
            if (lastRainPPR > previousPPR) {
                uint256 plentyPerRoot = lastRainPPR - previousPPR;
                previousPPR = lastRainPPR;
                plenty = plenty.add(
                    plentyPerRoot.mul(s.a[account].sop.roots).div(
                        C.getSopPrecision()
                    )
                );
            }
        } else {
            // If it was not raining, just use the PPR at previous sop
            previousPPR = s.sops[s.a[account].lastSop];
        }

        // Handle and SOPs that started + ended before after last Rain where t
        if (s.season.lastSop > lastUpdate(account)) {
            uint256 plentyPerRoot = s.sops[s.season.lastSop].sub(previousPPR);
            plenty = plenty.add(
                plentyPerRoot.mul(balanceOfRoots(account)).div(
                    C.getSopPrecision()
                )
            );
        }
    }

    function balanceOfRainRoots(address account) public view returns (uint256) {
        return s.a[account].sop.roots;
    }

    function balanceOfSop(address account)
        external
        view
        returns (AccountSeasonOfPlenty memory sop)
    {
        sop.lastRain = s.a[account].lastRain;
        sop.lastSop = s.a[account].lastSop;
        sop.roots = s.a[account].sop.roots;
        sop.plenty = balanceOfPlenty(account);
        sop.plentyPerRoot = s.a[account].sop.plentyPerRoot;
    }

    /**
     * Internal
     **/

    function season() internal view returns (uint32) {
        return s.season.current;
    }
}
