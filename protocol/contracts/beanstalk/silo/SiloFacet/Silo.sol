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
 * @notice FIXME(doc)
 */
 
contract Silo is SiloExit {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //////////////////////// EVENTS ////////////////////////    

    /**
     * @notice {Plant} is emitted when the Seeds associated with the Earned Beans of 'account' are Planted.
     * @param account is the account that owns the Earned Beans and receives the Planted Seeds.
     * @param beans is the number of Earned Beans 'account' owns, which determines the Seeds Planted.
     */
    event Plant(
        address indexed account,
        uint256 beans
    );

    /**
     * @notice {ClaimPlenty} is emitted when the assets paid to 'account' during a Flood are Claimed.
     * @param account is the account that owns and receives the assets paid during a Flood being Claimed.
     * @param plenty is the number of 3CRV the account has been Paid since their last ClaimPlenty.
     *
     * @dev Flood was previously called a Season of Plenty. For backwards compatibility, the event has
     * not been changed. For more information on Flood, see: {Fixme(doc)}.
     */
    event ClaimPlenty(
        address indexed account,
        uint256 plenty
    );

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
     * @dev Update the Silo for `msg.sender`.
     */
    modifier mowSender() {
        _mow(msg.sender);
        _;
    }

    /**
     * @dev anytime the state of an account's Silo changes, their Grown Stalk is Mown. 
     * {_mow} Mows the Grown Stalk of 'account' and is called at the beginning of 
     * every interaction with the Silo.
     *
     * For more info on Mowing, see: FIXME(doc)
     */
    function _mow(address account) internal {
        uint32 _lastUpdate = lastUpdate(account);

        // If 'account' was already updated this Season, there's no Stalk to Mow.
        // _lastUpdate > _season() should not be possible, but it is checked anyway.
        if (_lastUpdate >= _season()) return;

        // {handleRainAndSops} increments plenty if a SOP has occured and 
        // saves Rain Roots if its Raining for 'account'.
        handleRainAndSops(account, _lastUpdate);

        // {__mow} Mows the Grown Stalk from Seeds associated with 'account'.
        __mow(account);

        // Update the lastUpdate Season to the current `_season()`.
        s.a[account].lastUpdate = _season();
    }

    function __mow(address account) private {
        // If this `account` has no Seeds, skip to save gas.
        if (s.a[account].s.seeds == 0) return;
        LibSilo.mintStalk(account, balanceOfGrownStalk(account));
    }

    //////////////////////// INTERNAL: PLANT ////////////////////////

    /**
     * @dev Plants the Plantable Seeds of 'account' associated with its Earned Beans.
     * 
     * Anytime an account has Earned Beans, the Seeds associated with the Earned Beans must be Planted in order to start Growing Stalk. 
     * 
     * In practice, when Seeds are Planted, all Earned Beans are Deposited in the current Season.
     *
     * For more info on Planting, see: FIXME(doc)
     */
    function _plant(address account) internal returns (uint256 beans) {
        // Need to update 'account' before we make a Deposit.
        _mow(account);
        uint256 accountStalk = s.a[account].s.stalk;

        // Calculate balance of Earned Beans.
        beans = _balanceOfEarnedBeans(account, accountStalk);
        if (beans == 0) return 0;
        s.earnedBeans = s.earnedBeans.sub(beans);

        // Deposit Earned Beans if there are any.
        // Note that 1 Bean = 1 BDV.
        LibTokenSilo.addDepositToAccount(
            account,
            C.beanAddress(),
            _season(),
            beans, // amount
            beans // bdv
        );
        
        // Calculate the Plantable Seeds assocaited with the Earned Beans that were Deposited.
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
     * @dev Gas optimization: An account can call `{SiloFacet:claimPlenty}` even if
     * `s.a[account].sop.plenty == 0`. This would emit a ClaimPlenty event with an amount of 0.
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
