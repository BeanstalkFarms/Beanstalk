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

    /**
     * @notice Emitted when `account` gains or loses Seeds.
     * @param account The account that gained or lost Seeds.
     * @param delta The change in Seeds.
     * 
     *   
     *   - Add or remove a Deposit
     *   - Transfer a Deposit
     * 
     * Note: BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     *
     * [BIP-24](https://github.com/BeanstalkFarms/Beanstalk-Governance-Proposals/blob/master/bip/bip-24-fungible-bdv-support.md)
     * [Event-24-Event-Emission](https://github.com/BeanstalkFarms/Event-24-Event-Emission)
     */
    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots FIXME(doc)
     * 
     * @dev Emitted for ALL changes in Stalk balance for `account`, including:
     *   
     *   - Add or remove a Deposit
     *   - Transfer a Deposit
     * 
     * Note: BIP-24 included a one-time re-emission of {StalkBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution. For more, see:
     *
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
     * @dev WRAPPER: Increment the balance balance of Stalk & Seeds.
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
     * @dev Mint Seeds to `account`.
     */
    function mintSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);

        emit SeedsBalanceChanged(account, int256(seeds));
    }

    /**
     * @dev Mint Stalk to `account`.
     * 
     * Minting Stalk also mints associated Roots. See {FIXME(doc)} for an explanation of Roots accounting.
     */
    function mintStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Calculate amount of Roots for this amount of Stalk
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        // Add Stalk -> totals, account balance
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // Add Roots -> totals, account balance
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @dev WRAPPER: Withdrawing increments balance of Stalk & Seeds.
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
     * @dev FIXME(doc)
     */
    function burnSeeds(address account, uint256 seeds) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);

        emit SeedsBalanceChanged(account, -int256(seeds));
    }

    /**
     * @dev FIXME(doc)
     */
    function burnStalk(address account, uint256 stalk) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        uint256 roots = s.s.roots.mul(stalk).div(s.s.stalk);
        if (roots > s.a[account].roots) roots = s.a[account].roots;

        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

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
     * @dev WRAPPER: Transferring increments balance of Seeds & Stalk for
     * `receipient`, and decrements balance of Seeds & Stalk for `sender`.
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

    function transferSeeds(
        address sender,
        address recipient,
        uint256 seeds
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[sender].s.seeds = s.a[sender].s.seeds.sub(seeds);
        emit SeedsBalanceChanged(sender, -int256(seeds));

        s.a[recipient].s.seeds = s.a[recipient].s.seeds.add(seeds);
        emit SeedsBalanceChanged(recipient, int256(seeds));
    }

    function transferStalk(
        address sender,
        address recipient,
        uint256 stalk
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots = stalk == s.a[sender].s.stalk
            ? s.a[sender].roots
            : s.s.roots.sub(1).mul(stalk).div(s.s.stalk).add(1);

        s.a[sender].s.stalk = s.a[sender].s.stalk.sub(stalk);
        s.a[sender].roots = s.a[sender].roots.sub(roots);
        emit StalkBalanceChanged(sender, -int256(stalk), -int256(roots));

        s.a[recipient].s.stalk = s.a[recipient].s.stalk.add(stalk);
        s.a[recipient].roots = s.a[recipient].roots.add(roots);
        emit StalkBalanceChanged(recipient, int256(stalk), int256(roots));
    }
    
    //////////////////////// UTILITIES ////////////////////////

    /**
     * @param seeds The number of Seeds held.
     * @param seasons The number of Seasons that have elapsed.
     *
     * @dev Each Seed yields 1E-4 (0.0001, or 1 / 10_000) Stalk per Season.
     *
     * Seasons is measured to 0 decimals. There are no fractional Seasons.
     * Seeds are measured to 6 decimals.
     * Stalk is measured to 10 decimals.
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
