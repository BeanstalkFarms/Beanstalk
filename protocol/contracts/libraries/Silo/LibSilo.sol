/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";

/**
 * @title LibSilo
 * @author Publius
 * @notice FIXME(doc)
 */
library LibSilo {
    using SafeMath for uint256;
    
    //////////////////////// EVENTS ////////////////////////    

    /**
     * @notice {SeedsBalanceChanged} is emitted when `account` gains or loses Seeds.
     * @param account is the account that gained or lost Seeds.
     * @param delta is the change in Seeds.
     *   
     * @dev {SeedsBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred.
     * @dev BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );
     
     /**
     * @notice {StalkBalanceChanged} is emitted when `account` gains or loses Stalk.
     * @param account is the account that gained or lost Stalk.
     * @param delta is the change in Stalk.
     * @param deltaRoots is the change is Roots. For more info on Roots, see: 
     *   
     * @dev {StalkBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred AND
     * anytime an account Mows Grown Stalk.
     * @dev BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    //////////////////////// MINT ////////////////////////

    /**
     * @dev WRAPPER: {mintSeedsAndStalk} increments the Seeds, Stalk and Roots of an account and Beanstalk.
     */
    function mintSeedsAndStalk(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        mintSeeds(account, seeds);
        mintStalk(account, stalk);
    }

    /**
     * @dev {mintSeeds} mints Seeds to `account` and increments Beanstalk's total Seeds.
     */
    function mintSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Add Seeds to the account balance and Beanstalk total.
        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);

        emit SeedsBalanceChanged(account, int256(seeds));
    }

    /**
     * @dev {mintStalk} mints Stalk and Roots to `account` and increments Beanstalk's total Stalk and Roots.
     * For an explanation of Roots accounting see {FIXME(doc)}.
     */
    function mintStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        // Add Stalk to the account balance and Beanstalk total.
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // Add Roots to the account balance and Beanstalk total.
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @dev WRAPPER: {burnSeedsAndStalk} decrements the Seeds, Stalk and Roots of an account and Beanstalk.
     */
    function burnSeedsAndStalk(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        burnSeeds(account, seeds);
        burnStalk(account, stalk);
    }
    
    /**
     * @dev {burnSeeds} burns Seeds from `account` and decrements Beanstalk's total Seeds.
     */
    function burnSeeds(address account, uint256 seeds) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Subtract Stalk from the account balance and Beanstalk total.
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);

        emit SeedsBalanceChanged(account, -int256(seeds));
    }

    /**
     * @dev {burnStalk} burns Stalk and Roots from `account` and decrements Beanstalk's total Stalk and Roots.
     */
    function burnStalk(address account, uint256 stalk) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        // Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots = s.s.roots.mul(stalk).div(s.s.stalk);
        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // Subtract Stalk from the account balance and Beanstalk total.
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        // Subtract Roots from the account balance and Beanstalk total.
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
        
        // If it is Raining, subtract Roots from both the account's and Beanstalk's RainRoots balances.
        // For more info on Rain, see {Fixme(doc)}. 
        if (s.season.raining) {
            s.r.roots = s.r.roots.sub(roots);
            s.a[account].sop.roots = s.a[account].roots;
        }

        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @dev WRAPPER: {transferSeedsAndStalk} decrements the Seeds, Stalk and Roots of 'sender' account and 
     * increments the Seeds, Stalk and Roots of 'recipient' account.
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
     * @dev WRAPPER: {transferSeeds} decrements the Seeds of 'sender' account and 
     * increments the Seeds of 'recipient' account.
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
     * @dev WRAPPER: {transferStalk} decrements the Stalk and Roots of 'sender' account and 
     * increments the Stalk and Roots of 'recipient' account.
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
     * @notice {stalkReward} calculates the Stalk that has Grown from a given number of Seeds over a given number of Seasons.
     * @param seeds is the number of Seeds held.
     * @param seasons is the number of Seasons that have elapsed.
     *
     * @dev Each Seed yields 1E-4 (0.0001, or 1 / 10_000) Stalk per Season.
     * @dev Seasons is measured to 0 decimals. There are no fractional Seasons.
     * @dev Seeds are measured to 6 decimals.
     * @dev Stalk is measured to 10 decimals.
     * 
     * Example:
     *  - `seeds = 1E6` (1 Seed)
     *  - `seasons = 1` (1 Season)
     *  - The result is `1E6 * 1 = 1E6`. Since Stalk is measured to 10 decimals, this is `1E6/1E10 = 1E-4` Stalk.
     */
    function stalkReward(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}
