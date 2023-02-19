/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./SiloExit.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";

/**
 * @title Silo
 * @author Publius
 * @notice Provides utility functions for claiming Silo rewards, including:
 *
 * - Grown Stalk (see "Mow")
 * - Earned Beans, Earned Stalk, Plantable Seeds (see "Plant")
 * - 3CRV earned during a Flood (see "Flood")
 *
 * For backwards compatibility, a Flood is sometimes referred to by its old name
 * "Season of Plenty".
 */
 
contract Silo is SiloExit {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using LibSafeMath128 for uint128;


    //////////////////////// EVENTS ////////////////////////    

    /**
     * @notice Emitted when the Seeds associated with the Earned Beans of
     * `account` are Planted.
     * @param account Owns the Earned Beans and receives the Planted Seeds.
     * @param beans The amount of Earned Beans claimed by `account`. The number
     * of Seeds that were Planted can be derived, since 1 Bean => 2 Seeds.
     * See {C-getSeedsPerBean}.
     */
    event Plant(
        address indexed account,
        uint256 beans
    );

    /**
     * @notice Emitted when 3CRV paid to `account` during a Flood is Claimed.
     * @param account Owns and receives the assets paid during a Flood.
     * @param plenty The amount of 3CRV claimed by `account`. This is the amount
     * that `account` has been paid since their last {ClaimPlenty}.
     * 
     * @dev Flood was previously called a "Season of Plenty". For backwards
     * compatibility, the event has not been changed. For more information on 
     * Flood, see: {FIXME(doc)}.
     */
    event ClaimPlenty(
        address indexed account,
        uint256 plenty
    );

    /**
     * @notice Emitted when `account` gains or loses Seeds.
     * @param account The account that gained or lost Seeds.
     * @param delta The change in Seeds.
     *   
     * @dev {SeedsBalanceChanged} should be emitted anytime a Deposit is added, removed or transferred.
     * 
     * BIP-24 included a one-time re-emission of {SeedsBalanceChanged} for accounts that had
     * executed a Deposit transfer between the Replant and BIP-24 execution.
     * 
     * For more, see:
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
     * @param deltaRoots The change in Roots. For more info on Roots, see: 
     * FIXME(doc)
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

    //////////////////////// INTERNAL: MOW ////////////////////////

    /**
     * @dev Claims the Grown Stalk for `msg.sender`.
     */
    modifier mowSender() {
        _mow(msg.sender);
        _;
    }

    /**
     * @dev Claims the Grown Stalk for `account` and applies it to their Stalk
     * balance.
     *
     * A Farmer cannot receive Seeds unless the Farmer's `lastUpdate` Season is
     * equal to the current Season. Otherwise, they would receive extra Grown
     * Stalk when they receive Seeds.
     *
     * This is why `_mow()` must be called before any actions that change Seeds,
     * including:
     *  - {SiloFacet-deposit}
     *  - {SiloFacet-withdrawDeposit}
     *  - {SiloFacet-withdrawDeposits}
     *  - {_plant}
     *  - {SiloFacet-transferDeposit(s)}
     */
    function _mow(address account) internal {
        uint32 _lastUpdate = lastUpdate(account);

        if (_lastUpdate >= _season()) return;


        // Increments `plenty` for `account` if a Flood has occured.
        // Saves Rain Roots for `account` if it is Raining.
        handleRainAndSops(account, _lastUpdate);

        // Calculate the amount of Grown Stalk claimable by `account`.
        // Increase the account's balance of Stalk and Roots.
        __mow(account);

        // Reset timer so that Grown Stalk for a particular Season can only be 
        // claimed one time. 
        s.a[account].lastUpdate = _season();
    }

    function __mow(address account) private {
        // If this `account` has no Seeds, skip to save gas.
        uint256 _stalk = balanceOfGrownStalk(account);
        if (s.a[account].s.seeds == 0) return;
        // if the account mows in the morning, we need the last update to calculate the grownStalk,
        // which is then used to calculate the additional roots given to the user: 
        LibSilo.mintGrownStalkAndGrownRoots(account, _stalk);
    }

    //////////////////////// INTERNAL: PLANT ////////////////////////

    /**
     * @dev Plants the Plantable Seeds of `account` associated with its Earned
     * Beans.
     * 
     * For more info on Planting, see: {SiloFacet-plant}
     */
    function _plant(address account) internal returns (uint256 beans) {
        // per the zero withdraw update, planting is handled differently 
        // depending whether or not the user plants during the vesting period of beanstalk. 
        // during the vesting period, the earned beans are not issued to the user.
        // thus, the roots calculated for a given user is different. 
        // This is handled by the super mow function, which stores the difference in roots.
        _mow(account);
        uint256 accountStalk =  s.a[account].s.stalk;
        beans = _balanceOfEarnedBeans(account, accountStalk);

        if (beans == 0) return 0;

        // Reduce the Silo's supply of Earned Beans.
        s.earnedBeans = s.earnedBeans.sub(uint128(beans));

        // Deposit Earned Beans if there are any. Note that 1 Bean = 1 BDV.
        LibTokenSilo.addDepositToAccount(
            account,
            C.beanAddress(),
            _season(),
            beans, // amount
            beans // bdv
        );
        
        // Calculate the Plantable Seeds associated with the Earned Beans that were Deposited.
        uint256 seeds = beans.mul(C.getSeedsPerBean());

        // Plantable Seeds don't generate Grown Stalk until they are Planted (i.e., not auto-compounding). 
        // Plantable Seeds are not included in the Seed supply, so new Seeds must be minted during `plant()`.
        // (Notice that {Sun.sol:rewardToSilo} does not mint any Seeds, even though it updates Earned Beans.)
        LibSilo.mintSeeds(account, seeds); // mints to `account` and updates totals

        // Earned Stalk associated with Earned Beans generate more Earned Beans automatically (i.e., auto compounding).
        // Earned Stalk are minted when Earned Beans are minted during Sunrise. See {Sun.sol:rewardToSilo} for details.
        // Similarly, `account` does not receive additional Roots from Earned Stalk during a Plant.
        // The following lines allocate Earned Stalk that has already been minted to `account`.
        uint256 stalk = beans.mul(C.getStalkPerBean());
        s.a[account].s.stalk = accountStalk.add(stalk);

        emit StalkBalanceChanged(account, int256(stalk), 0);
        emit Plant(account, beans);
    }

    //////////////////////// INTERNAL: SEASON OF PLENTY ////////////////////////

    /**
     * @dev Gas optimization: An account can call `{SiloFacet:claimPlenty}` even
     * if `s.a[account].sop.plenty == 0`. This would emit a ClaimPlenty event
     * with an amount of 0.
     */
    function _claimPlenty(address account) internal {
        // Plenty is earned in the form of 3Crv.
        uint256 plenty = s.a[account].sop.plenty;
        C.threeCrv().safeTransfer(account, plenty);
        delete s.a[account].sop.plenty;

        emit ClaimPlenty(account, plenty);
    }

    /**
     * FIXME(refactor): replace `lastUpdate()` -> `_lastUpdate()` and rename this param?
     */
    function handleRainAndSops(address account, uint32 _lastUpdate) private {
        // If no roots, reset Sop counters variables
        if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.season.rainStart;
            s.a[account].lastRain = 0;
            return;
        }
        // If a Sop has occured since last update, calculate rewards and set last Sop.
        if (s.season.lastSopSeason > _lastUpdate) {
            s.a[account].sop.plenty = balanceOfPlenty(account);
            s.a[account].lastSop = s.season.lastSop;
        }
        if (s.season.raining) {
            // If rain started after update, set account variables to track rain.
            if (s.season.rainStart > _lastUpdate) {
                s.a[account].lastRain = s.season.rainStart;
                s.a[account].sop.roots = s.a[account].roots;
            }
            // If there has been a Sop since rain started,
            // save plentyPerRoot in case another SOP happens during rain.
            if (s.season.lastSop == s.season.rainStart)
                s.a[account].sop.plentyPerRoot = s.sops[s.season.lastSop];
        } else if (s.a[account].lastRain > 0) {
            // Reset Last Rain if not raining.
            s.a[account].lastRain = 0;
        }
    }

}
