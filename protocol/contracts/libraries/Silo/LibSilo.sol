/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibPRBMath.sol";
import "~/libraries/LibSafeMathSigned128.sol";
import "hardhat/console.sol";
import "../LibSafeMath128.sol";


/**
 * @title LibSilo
 * @author Publius
 * @notice Contains functions for minting, burning, and transferring of
 * Stalk and Roots within the Silo.
 *
 * @dev FIXME(DISCUSS): Here, we refer to "minting" as the combination of
 * increasing the total balance of Stalk/Roots, as well as allocating
 * them to a particular account. However, in other places throughout Beanstalk
 * (like during the Sunrise), Beanstalk's total balance of Stalk increases
 * without allocating to a particular account. One example is {Sun-rewardToSilo}
 * which increases `s.s.stalk` but does not allocate it to any account. The
 * allocation occurs during `{SiloFacet-plant}`. Does this change how we should
 * call "minting"?
 *
 * In the ERC20 context, "minting" increases the supply of a token and allocates
 * the new tokens to an account in one action. I've adjusted the comments below
 * to use "mint" in the same sense.
 */
library LibSilo {
    using SafeMath for uint256;
    using SafeMath for uint128;
    using LibSafeMathSigned128 for int128;
    using LibPRBMath for uint256;
    using LibSafeMath128 for uint128;
    
    //////////////////////// EVENTS ////////////////////////    

    //TODOSEEDS what should we emit here? presumably now seeds could change every season even
    //should probably include token, grown stalk index, current season?
    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );
     
     /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots The change in Roots.
     *   
     * @dev Should be emitted anytime a Deposit is added, removed or transferred
     * AND anytime an account Mows Grown Stalk.
     * 
     * BIP-24 included a one-time re-emission of {StalkBalanceChanged} for
     * accounts that had executed a Deposit transfer between the Replant and
     * BIP-24 execution. For more, see:
     *
     * [BIP-24](https://bean.money/bip-24)
     * [Event-Emission](https://github.com/BeanstalkFarms/BIP-24-Event-Emission)
     */
    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    //////////////////////// MINT ////////////////////////

    /**
     * @dev Mints Stalk and Roots to `account`.
     *
     * For an explanation of Roots accounting, see {FIXME(doc)}.
     */
    function mintStalk(address account, uint256 stalk) internal {
        console.log('mintStalk account: ', account);
        console.log('mintStalk stalk: ', stalk);
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots;
        if (s.s.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
        }

        console.log('mintStalk previous total stalk s.s.stalk: ', s.s.stalk);
        
        // increment user and total stalk
        s.s.stalk = s.s.stalk.add(stalk);
        console.log('mintStalk new total stalk s.s.stalk: ', s.s.stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // console.log('new total stalk s.a[account].s.stalk: ', s.a[account].s.stalk);

        // increment user and total roots
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);


        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }


    /**
     * @dev mints grownStalk to `account`.
     * per the zero-withdraw update, if a user plants during the morning,
     * the roots needed to properly calculate the earned beans would be higher 
     * than outside the morning. Thus, if a user mows in the morning, 
     * additional calculation is done and stored for the {plant} function.
     * @param account farmer
     * @param stalk the amount of stalk to mint
     */
    function mintGrownStalkAndGrownRoots(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 roots;
        if (s.s.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else  {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
            if (block.number - s.season.sunriseBlock <= 25) {
                uint256 rootsWithoutEarned = s.s.roots.add(s.newEarnedRoots).mul(stalk).div(s.s.stalk - (s.newEarnedStalk));
                uint256 deltaRoots = rootsWithoutEarned - roots;
                s.newEarnedRoots = s.newEarnedRoots.add(uint128(deltaRoots));
                s.a[account].deltaRoots = uint128(deltaRoots);
            } 
        }

        // increment user and total stalk
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // increment user and total roots
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @dev Burns Stalk and Roots from `account`.
     *
     * For an explanation of Roots accounting, see {FIXME(doc)}.
     */
    function burnStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        console.log('burnStalk burn amount: ', stalk);
        console.log('burnStalk current total stalk s.s.stalk: ', s.s.stalk);
       
        uint256 roots;
        // Calculate the amount of Roots for the given amount of Stalk.
        // We round up as it prevents an account having roots but no stalk.
        
        // if the user withdraws in the same block as sunrise, they forfeit their earned beans for that season
        // this is distrubuted to the other users.
        // should this be the same as the vesting period?
        if(block.number - s.season.sunriseBlock <= 25){
            roots = s.s.roots.mulDiv(
            stalk,
            s.s.stalk-s.newEarnedStalk,
            LibPRBMath.Rounding.Up);

        } else { 
            roots = s.s.roots.mulDiv(
            stalk,
            s.s.stalk,
            LibPRBMath.Rounding.Up);
        }

        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // Decrease supply of Stalk; Remove Stalk from the balance of `account`
        console.log('burnStalk previous total stalk s.s.stalk: ', s.s.stalk);
        s.s.stalk = s.s.stalk.sub(stalk);
        console.log('burnStalk new stalk after burn s.s.stalk: ', s.s.stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
        
        // If it is Raining, subtract Roots from both the account's and 
        // Beanstalk's RainRoots balances.
        // For more info on Rain, see {FIXME(doc)}. 
        if (s.season.raining) {
            s.r.roots = s.r.roots.sub(roots);
            console.log('burnStalk updating s.a[account].sop.roots', s.a[account].sop.roots);
            s.a[account].sop.roots = s.a[account].roots;
        }

        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @dev Decrements the Stalk and Roots of `sender` and increments the Stalk
     * and Roots of `recipient` by the same amount.
     */
    function transferStalk(
        address sender,
        address recipient,
        uint256 stalk
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // (Fixme?) Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots = stalk == s.a[sender].s.stalk
            ? s.a[sender].roots
            : s.s.roots.sub(1).mul(stalk).div(s.s.stalk).add(1);

        // Subtract Stalk and Roots from the 'sender' balance.        
        s.a[sender].s.stalk = s.a[sender].s.stalk.sub(stalk);
        s.a[sender].roots = s.a[sender].roots.sub(roots);
        emit StalkBalanceChanged(sender, -int256(stalk), -int256(roots));

        // Add Stalk and Roots to the 'recipient' balance.
        s.a[recipient].s.stalk = s.a[recipient].s.stalk.add(stalk);
        s.a[recipient].roots = s.a[recipient].roots.add(roots);
        emit StalkBalanceChanged(recipient, int256(stalk), int256(roots));
    }
    
    //////////////////////// UTILITIES ////////////////////////

    /**
     * This function will take in a start stalk per bdv, end stalk per bdv,
     * and the deposited bdv amount, and return
     *
     */
    function stalkReward(int128 startStalkPerBDV, int128 endStalkPerBDV, uint128 bdv) //are the types what we want here?
        internal
        view //change back to pure
        returns (uint256)
    {
        console.log('stalkReward startStalkPerBDV: ');
        console.logInt(startStalkPerBDV);
        console.log('stalkReward endStalkPerBDV: ');
        console.logInt(endStalkPerBDV);
        console.log('stalkReward bdv: ', bdv);
        int128 reward = endStalkPerBDV.sub(startStalkPerBDV).mul(int128(bdv));
        return uint128(reward);
    }

    function stalkRewardLegacy(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}