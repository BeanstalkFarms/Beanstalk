/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibPRBMath.sol";
import "../LibSafeMath128.sol";


/**
 * @title LibSilo
 * @author Publius
 * @notice Contains functions for minting, burning, and transferring of Seeds,
 * Stalk and Roots within the Silo.
 *
 * @dev FIXME(DISCUSS): Here, we refer to "minting" as the combination of
 * increasing the total balance of Stalk/Seeds/Roots, as well as allocating
 * them to a particular account. However, in other places throughout Beanstalk
 * (like during the Sunrise), Beanstalk's total balance of Stalk/Seeds increases
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
    using LibPRBMath for uint256;
    using LibSafeMath128 for uint128;
    
    //////////////////////// EVENTS ////////////////////////

    /**
     * @notice Emitted when `account` gains or loses Seeds.
     * @param account The account that gained or lost Seeds.
     * @param delta The change in Seeds.
     *   
     * @dev Should be emitted any time a Deposit is added, removed or
     * transferred.
     * 
     * BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for
     * accounts that had executed a Deposit transfer between the Replant and
     * BIP-24 execution. For more, see:
     *
     * [BIP-24](https://bean.money/bip-24)
     * [Event-Emission](https://github.com/BeanstalkFarms/BIP-24-Event-Emission)
     */
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
     * @dev WRAPPER: Mints Seeds, Stalk and Roots to `account`.
     */
    function mintSeedsAndStalk(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        mintSeeds(account, seeds);
        mintStalk(account, stalk); // also mints Roots
    }

    /**
     * @dev Mints Seeds to `account`.
     */
    function mintSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Increase supply of Seeds; Add Seeds to the balance of `account`
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);

        emit SeedsBalanceChanged(account, int256(seeds));
    }

    /**
     * @dev Mints Stalk and Roots to `account`.
     *
     * For an explanation of Roots accounting, see {FIXME(doc)}.
     */
    function mintStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots;
        if (s.s.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
        }

        // increment user and total stalk
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

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

        // uint256 roots;
        // if (s.s.roots == 0) {
        //     roots = uint256(stalk.mul(C.getRootsBase()));
        // } else {
        //     roots = s.s.roots.mul(stalk).div(s.s.stalk);
        //     if (block.number - s.season.sunriseBlock <= 25) {
        //         uint256 noSeigniorageRoots = s.s.roots.add(s.vestingPeriodRoots).mul(stalk).div(s.s.stalk - s.newEarnedStalk);
        //         uint256 deltaRoots = noSeigniorageRoots - roots;
        //         s.vestingPeriodRoots = s.vestingPeriodRoots.add(uint128(deltaRoots)); // only track roots that would have been realized through Earned Beans
        //         // @audit this state is used in only one place, which immediately follows a call of this function. no need to save it in state.
        //         s.a[account].deltaRoots = uint128(deltaRoots);
        //     } 
        // }
        
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

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
     * @dev WRAPPER: Burns Seeds, Stalk and Roots from `account`.
     */
    function burnSeedsAndStalk(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        burnSeeds(account, seeds);
        burnStalkAndRoots(account, stalk); // also burns Roots
    }
    
    /**
     * @dev Burns Seeds from `account`.
     */
    function burnSeeds(address account, uint256 seeds) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Decrease supply of Seeds; Remove Seeds from the balance of `account`
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);

        emit SeedsBalanceChanged(account, -int256(seeds));
    }

    /**
     * @dev Burns Stalk and Roots from `account`.
     *
     * For an explanation of Roots accounting, see {FIXME(doc)}.
     */
    function burnStalkAndRoots(address account, uint256 stalk) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        uint256 roots = s.s.roots.mul(stalk).div(s.s.stalk);

        // uint256 roots;
        // Calculate the amount of Roots for the given amount of Stalk.
        // We round up as it prevents an account having roots but no stalk.

        // @audit - withdrawer will lose all seasonal Earned Beans at withdraw time, rather than just the ones associated with the withdraw.

        /// @audit the way roots while vesting is calculated here is different than above. Why is a an unexpected
        ///        amount of roots being burned here?

        /// @audit @fix no adjustments are needed here, because the user cannot claim their Earned beans in the morning,
        ///         therefore they will not see those earned beans in their stalk or root balances.

        // if the user withdraws in the morning, they forfeit their earned beans for that season
        // this is distributed to the other users.
        // if(block.number - s.season.sunriseBlock <= 25){
        //     roots = s.s.roots.mulDiv(
        //     stalk, // adjusting the stalk denominator but not the numerator seems like it may have unexpected results.
        //     s.s.stalk-s.newEarnedStalk,
        //     LibPRBMath.Rounding.Up);

        // } else { 
        //     roots = s.s.roots.mulDiv(
        //     stalk,
        //     s.s.stalk,
        //     LibPRBMath.Rounding.Up);
        // }

        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // Decrease supply of Stalk; Remove Stalk from the balance of `account`
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
        
        // If it is Raining, subtract Roots from both the account's and 
        // Beanstalk's RainRoots balances.
        // For more info on Rain, see {FIXME(doc)}. 
        if (s.season.raining) {
            s.r.roots = s.r.roots.sub(roots);
            s.a[account].sop.roots = s.a[account].roots;
        }

        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @dev WRAPPER: Decrements the Seeds, Stalk and Roots of `sender` and 
     * increments the Seeds, Stalk and Roots of `recipient` by the same amount.
     */
    function transferSeedsAndStalk(
        address sender,
        address recipient,
        uint256 seeds,
        uint256 stalk
    ) internal {
        transferSeeds(sender, recipient, seeds);
        transferStalk(sender, recipient, stalk);
    }

    /**
     * @dev Decrements the Seeds of `sender` and increments the Seeds of 
     * `recipient` by the same amount.
     */
    function transferSeeds(
        address sender,
        address recipient,
        uint256 seeds
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        // Subtract Seeds from the 'sender' balance.
        s.a[sender].s.seeds = s.a[sender].s.seeds.sub(seeds);
        emit SeedsBalanceChanged(sender, -int256(seeds));
        
        // Add Seeds to the 'recipient' balance.
        s.a[recipient].s.seeds = s.a[recipient].s.seeds.add(seeds);
        emit SeedsBalanceChanged(recipient, int256(seeds));
    }

    /**
     * @dev Decrements the Stalk and Roots of `sender` and increments the Stalk
     * and Roots of `recipient` by the same amount.
     */
    function transferStalk(
        address sender,
        address recipient,
        uint256 stalk
    ) private {
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
     * @param seeds The number of Seeds held.
     * @param seasons The number of Seasons that have elapsed.
     *
     * @dev Calculates the Stalk that has Grown from a given number of Seeds
     * over a given number of Seasons.
     *
     * Each Seed yields 1E-4 (0.0001, or 1 / 10_000) Stalk per Season.
     *
     * Seasons is measured to 0 decimals. There are no fractional Seasons.
     * Seeds are measured to 6 decimals.
     * Stalk is measured to 10 decimals.
     * 
     * Example:
     *  - `seeds = 1E6` (1 Seed)
     *  - `seasons = 1` (1 Season)
     *  - The result is `1E6 * 1 = 1E6`. Since Stalk is measured to 10 decimals,
     *    this is `1E6/1E10 = 1E-4` Stalk.
     */
    function stalkReward(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}