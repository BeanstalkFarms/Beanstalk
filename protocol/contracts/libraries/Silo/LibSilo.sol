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
 * @notice
 */
library LibSilo {
    using SafeMath for uint256;

    /**
     * @notice Emitted when `account` gains or loses Seeds.
     * @param account 
     * @param delta int256 The change in Seeds.
     * 
     * @dev:
     *
     * Emitted for ALL changes in Seeds balance for `account`, including:
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
     * @param account 
     * @param delta int256 The change in Stalk.
     * @param deltaRoots int256 FIXME(doc)
     * 
     * @dev:
     *
     * Emitted for ALL changes in Stalk balance for `account`, including:
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

    //////////////////////// WRAPPERS ////////////////////////

    /**
     * @dev Wrapper: Depositing increments balance of Stalk & Seeds.
     */
    function depositSiloAssets(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        incrementBalanceOfStalk(account, stalk);
        incrementBalanceOfSeeds(account, seeds);
    }

    /**
     * @dev Wrapper: Withdrawing increments balance of Stalk & Seeds.
     */
    function withdrawSiloAssets(
        address account,
        uint256 seeds,
        uint256 stalk
    ) internal {
        decrementBalanceOfStalk(account, stalk);
        decrementBalanceOfSeeds(account, seeds);
    }

    /**
     * @dev Wrapper: Transferring increments balance of Stalk & Seeds for
     * `receipient`, and decrepements balance of Stalk & Seeds for `sender`.
     */
    function transferSiloAssets(
        address sender,
        address recipient,
        uint256 seeds,
        uint256 stalk
    ) internal {
        transferStalk(sender, recipient, stalk);
        transferSeeds(sender, recipient, seeds);
    }

    //////////////////////// INCREMENT ////////////////////////

    /**
     * @dev 
     */
    function incrementBalanceOfSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.s.seeds = s.s.seeds.add(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.add(seeds);

        emit SeedsBalanceChanged(account, int256(seeds));
    }

    /**
     * @dev Increase the balance of Stalk and Roots for an account.
     * 
     * See {FIXME(doc)} for an explanation of Roots accounting.
     *  
     * FIXME(doc) why .s.stalk but not .s.roots?
     */
    function incrementBalanceOfStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        /// Calculate amount of Roots for this amount of Stalk
        uint256 roots;
        if (s.s.roots == 0) roots = stalk.mul(C.getRootsBase());
        else roots = s.s.roots.mul(stalk).div(s.s.stalk);

        /// Add Stalk to global & user Silo
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        /// Add Roots to global & user Silo
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    //////////////////////// DECREMENT ////////////////////////

    function decrementBalanceOfSeeds(address account, uint256 seeds) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);

        emit SeedsBalanceChanged(account, -int256(seeds));
    }

    function decrementBalanceOfStalk(address account, uint256 stalk) private {
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

    function stalkReward(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }
}
