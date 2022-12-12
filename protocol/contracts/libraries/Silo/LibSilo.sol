/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibPRBMath.sol";



/**
 * @author Publius
 * @title Lib Silo
 **/
library LibSilo {
    using SafeMath for uint256;
    using LibPRBMath for uint256;

    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

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
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        // Increase supply of Stalk; Add Stalk to the balance of `account`
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // Increase supply of Roots; Add Roots to the balance of `account`
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
        burnStalk(account, stalk); // also burns Roots
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
    function burnStalk(address account, uint256 stalk) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;
        // round up 
        uint256 roots = s.s.roots.mulDiv(
            stalk,
            s.s.stalk,
            LibPRBMath.Rounding.Up);
        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // subtract stalk and roots from account and global state 
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);


        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);

       
        
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
