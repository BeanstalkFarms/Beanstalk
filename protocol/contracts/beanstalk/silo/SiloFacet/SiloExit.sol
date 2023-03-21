/*
/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "~/beanstalk/ReentrancyGuard.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/LibSafeMath128.sol";
import "~/libraries/LibPRBMath.sol";
import "~/C.sol";

/**
 * @title SiloExit, Brean
 * @author Publius
 * @notice Exposes public view functions for Silo total balances, account
 * balances, account update history, and Season of Plenty (SOP) balances.
 *
 * Provieds utility functions like {_season} for upstream usage throughout
 * SiloFacet.
 */
contract SiloExit is ReentrancyGuard {
    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;
    using LibPRBMath for uint256;

    uint256 constant private EARNED_BEAN_VESTING_BLOCKS = 25; //  5 minutes

    /**
     * @dev Stores account-level Season of Plenty balances.
     * 
     * Returned by {balanceOfSop}.
     */
    struct AccountSeasonOfPlenty {
        // The Season that it started Raining, if it was Raining during the last
        // Season in which `account` updated their Silo. Otherwise, 0.
        uint32 lastRain; 
        // The last Season of Plenty starting Season processed for `account`.
        uint32 lastSop;
        // `account` balance of Roots when it started raining. 
        uint256 roots; 
        // The global Plenty per Root at the last Season in which `account`
        // updated their Silo.
        uint256 plentyPerRoot; 
        // `account` balance of unclaimed Bean:3Crv from Seasons of Plenty.
        uint256 plenty; 
    }

    //////////////////////// UTILTIES ////////////////////////

    /**
     * @notice Get the last Season in which `account` updated their Silo.
     */
    function lastUpdate(address account) public view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    //////////////////////// SILO: TOTALS ////////////////////////

    /**
     * @notice Returns the total supply of Stalk. Does NOT include Grown Stalk.
     */
    function totalStalk() public view returns (uint256) {
        return s.s.stalk;
    }

    /**
     * @notice Returns the total supply of Roots.
     */
    function totalRoots() public view returns (uint256) {
        return s.s.roots;
    }

    /**
     * @notice Returns the total supply of Earned Beans.
     * @dev Beanstalk's "supply" of Earned Beans is a subset of the total Bean
     * supply. Earned Beans are simply seignorage Beans held by Beanstalk for 
     * distribution to Stalkholders during {SiloFacet-plant}.   
     */
    function totalEarnedBeans() public view returns (uint256) {
        return s.earnedBeans;
    }

    //////////////////////// SILO: ACCOUNT BALANCES ////////////////////////

    /**
     * @notice Returns the balance of Stalk for `account`. 
     * Does NOT include Grown Stalk.
     * DOES include Earned Stalk.
     * @dev Earned Stalk earns Bean Mints, but Grown Stalk does not due to
     * computational complexity.
     */
    function balanceOfStalk(address account) public view returns (uint256) {
        return s.a[account].s.stalk.add(balanceOfEarnedStalk(account));
    }

    /**
     * @notice Returns the balance of Roots for `account`.
     * @dev Roots within Beanstalk are entirely separate from the 
     * [ROOT ERC-20 token](https://roottoken.org/).
     * 
     * Roots represent proportional ownership of Stalk:
     *  `balanceOfStalk / totalStalk = balanceOfRoots / totalRoots`
     * 
     * Roots are used to calculate Earned Bean, Earned Stalk and Plantable Seed
     * balances.
     *
     * FIXME(doc): how do Roots relate to Raining?
     */
    function balanceOfRoots(address account) public view returns (uint256) {
        return s.a[account].roots;
    }

    /**
     * @notice Returns the balance of Grown Stalk for `account`. Grown Stalk is 
     * earned each Season from BDV and must be Mown via `SiloFacet-mow` to 
     * apply it to a user's balance.
     * 
     * @dev This passes in the last stem the user mowed at and the current stem
     */
    function balanceOfGrownStalk(address account, address token)
        public
        view
        returns (uint256)
    {
        return
            LibSilo._balanceOfGrownStalk(
                s.a[account].mowStatuses[token].lastStem, //last stem farmer mowed
                LibTokenSilo.stemTipForToken(IERC20(token)), //get latest stem for this token
                s.a[account].mowStatuses[token].bdv
            );
    }

    
    /**
     * @notice Returns the balance of Earned Beans for `account`. Earned Beans
     * are the Beans distributed to Stalkholders during {Sun-rewardToSilo}.
     * @dev in the case where a user calls balanceOfEarned beans during the vesting period,
     * we have to manually calculate the deltaRoots and newEarnedRoots, as they are not stored in the state.
     * this is done in {_calcRoots} and {_balanceOfEarnedBeansVested}.
     */
    function balanceOfEarnedBeans(address account)
        public
        view
        returns (uint256 beans)
    {
        beans = _balanceOfEarnedBeans(account, s.a[account].s.stalk);
    }

    /**
     * @dev Internal function to compute `account` balance of Earned Beans.
     *
     * The number of Earned Beans is equal to the difference between: 
     *  - the "expected" Stalk balance, determined from the account balance of 
     *    Roots. 
     *  - the "account" Stalk balance, stored in account storage.
     * divided by the number of Stalk per Bean.
     * The earned beans from the latest season 
     */
    function _balanceOfEarnedBeans(address account, uint256 accountStalk) 
        internal
        view
        returns (uint256 beans) {
        // There will be no Roots before the first Deposit is made.
        if (s.s.roots == 0) return 0;

        uint256 stalk;
        if(block.number - s.season.sunriseBlock <= EARNED_BEAN_VESTING_BLOCKS){
            stalk = s.s.stalk.sub(s.newEarnedStalk).mulDiv(
                s.a[account].roots.add(s.a[account].deltaRoots), // add the delta roots of the user
                s.s.roots.add(s.newEarnedRoots), // add delta of global roots 
                LibPRBMath.Rounding.Up
            );
        } else {
            stalk = s.s.stalk.mulDiv(
                s.a[account].roots,
                s.s.roots,
                LibPRBMath.Rounding.Up
            );
        }
        
        // Beanstalk rounds down when minting Roots. Thus, it is possible that
        // balanceOfRoots / totalRoots * totalStalk < s.a[account].s.stalk.
        // As `account` Earned Balance balance should never be negative, 
        // Beanstalk returns 0 instead.
        if (stalk <= accountStalk) return 0;

        // Calculate Earned Stalk and convert to Earned Beans.
        beans = (stalk - accountStalk).div(C.getStalkPerBean()); // Note: SafeMath is redundant here.
        if (beans > s.earnedBeans) return s.earnedBeans;

        return beans;
    }

    /**
     * @notice Return the `account` balance of Earned Stalk, the Stalk
     * associated with Earned Beans.
     * @dev Earned Stalk can be derived from Earned Beans because 
     * 1 Bean => 1 Stalk. See {C-getStalkPerBean}.
     */
    function balanceOfEarnedStalk(address account)
        public
        view
        returns (uint256)
    {
        return balanceOfEarnedBeans(account).mul(C.getStalkPerBean());
    }

    //////////////////////// SEASON OF PLENTY ////////////////////////

    /**
     * @notice Returns the last Season that it started Raining resulting in a 
     * Season of Plenty.
     */
    function lastSeasonOfPlenty() public view returns (uint32) {
        return s.season.lastSop;
    }

    /**
     * @notice Returns the `account` balance of unclaimed BEAN:3CRV earned from 
     * Seasons of Plenty.
     */
    function balanceOfPlenty(address account)
        public
        view
        returns (uint256 plenty)
    {
        return LibSilo.balanceOfPlenty(account);
    }

    /**
     * @notice Returns the `account` balance of Roots the last time it was 
     * Raining during a Silo update.
     */
    function balanceOfRainRoots(address account) public view returns (uint256) {
        return s.a[account].sop.roots;
    }

    /**
     * @notice Returns the `account` Season of Plenty related state variables.
     * @dev See {AccountSeasonOfPlenty} struct.
     */
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


    //////////////////////// STEM ////////////////////////
    // per the silo V3.1 update, the internal accounting mechanism switched
    // from "season" to "stem", where "stem" is the 
    // Total Grown Stalk per BDV assoicated with an asset.

    /**
     * @notice Returns the `stem` for a given token.
     * @dev See {AccountSeasonOfPlenty} struct.
     */
    function stemTipForToken(IERC20 token)
        external
        view
        returns (int96 _stemTip)
    {
        _stemTip = LibTokenSilo.stemTipForToken(
            token
        );
    }

    /**
     * @notice converts the `season` to a `stem` for a given token.
     */
    function seasonToStem(IERC20 token, uint32 season)
        external
        view
        returns (int96 stem)
    {
        uint256 seedsPerBdv = getSeedsPerToken(address(token));
        stem = LibLegacyTokenSilo.seasonToStem(seedsPerBdv, season);
    }

    /**
     * @notice gets the seeds for a given token
     * @dev as seeds are deprecated on an accounting level, this is retained for 
     * backwards compatability. 
     */
    function getSeedsPerToken(address token) public view virtual returns (uint256) {
        return LibLegacyTokenSilo.getSeedsPerToken(token);
    }

    /**
     * @notice outputs the season in which the 
     * accounting level changed from season to stem.
     */
    function stemStartSeason() public view virtual returns (uint16) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.season.stemStartSeason;
    }

    //////////////////////// INTERNAL ////////////////////////

    /**
     * @dev Returns the current Season number.
     */
    function _season() internal view returns (uint32) {
        return s.season.current;
    }
}
