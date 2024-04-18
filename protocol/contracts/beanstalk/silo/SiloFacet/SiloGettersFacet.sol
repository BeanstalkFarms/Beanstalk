/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage, Account} from "contracts/beanstalk/AppStorage.sol";
import {LibLegacyTokenSilo} from "contracts/libraries/Silo/LibLegacyTokenSilo.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @title SiloGettersFacet contains view functions related to the silo.
 **/
contract SiloGettersFacet is ReentrancyGuard {

    using SafeMath for uint256;
    using LibSafeMath128 for uint128;

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

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice Find the amount and BDV of `token` that `account` has Deposited in stem index `stem`.
     *
     * Returns a deposit tuple `(uint256 amount, uint256 bdv)`.
     *
     * @return amount The number of tokens contained in this Deposit.
     * @return bdv The BDV associated with this Deposit.
     */
    function getDeposit(
        address account,
        address token,
        int96 stem
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.getDeposit(account, token, stem);
    }

    /**
     * @notice Get the total amount of `token` currently Deposited in the Silo across all users.
     * @dev does not include germinating tokens.
     */
    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
    }

    /**
     * @notice Get the total bdv of `token` currently Deposited in the Silo across all users.
     * @dev does not include germinating bdv.
     */
    function getTotalDepositedBdv(address token) external view returns (uint256) {
        return s.siloBalances[token].depositedBdv;
    }

    /**
     * @notice returns the germinating deposited amount of `token` for the current season.
     */
    function getGerminatingTotalDeposited(address token) external view returns (uint256 amount) {
        ( , amount) = LibGerminate.getTotalGerminatingForToken(token);
    }

    /**
     * @notice returns the germinating deposited bdv of `token` for the current season.
     */
    function getGerminatingTotalDepositedBdv(address token) external view returns (uint256 _bdv) {
        (_bdv, ) = LibGerminate.getTotalGerminatingForToken(token);
    }

    /**
     * @notice Get the Storage.SiloSettings for a whitelisted Silo token.
     *
     * Contains:
     *  - the BDV function selector
     *  - Stalk per BDV
     *  - stalkEarnedPerSeason
     *  - milestoneSeason
     *  - lastStem
     */
    function tokenSettings(address token) external view returns (Storage.SiloSettings memory) {
        return s.ss[token];
    }

    //////////////////////// ERC1155 ////////////////////////

    /**
     * @notice returns the amount of tokens in a Deposit.
     *
     * @dev see {getDeposit} for both the bdv and amount.
     */
    function balanceOf(address account, uint256 depositId) external view returns (uint256 amount) {
        return s.a[account].deposits[depositId].amount;
    }

    /**
     * @notice returns an array of amounts corresponding to Deposits.
     */
    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata depositIds
    ) external view returns (uint256[] memory) {
        require(accounts.length == depositIds.length, "ERC1155: ids and amounts length mismatch");
        uint256[] memory balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = s.a[accounts[i]].deposits[depositIds[i]].amount;
        }
        return balances;
    }

    /**
     * @notice outputs the depositID given an token address and stem.
     */
    function getDepositId(address token, int96 stem) external pure returns (uint256) {
        return LibBytes.packAddressAndStem(token, stem);
    }

    /**
     * @notice returns the bean denominated value ("bdv") of a token amount.
     */
    function bdv(address token, uint256 amount)
        external
        view
        returns (uint256 _bdv)
    {
        _bdv = LibTokenSilo.beanDenominatedValue(token, amount);
    }

    //////////////////////// UTILTIES ////////////////////////

    /**
     * @notice Get the last Season in which `account` updated their Silo.
     */
    function lastUpdate(address account) external view returns (uint32) {
        return s.a[account].lastUpdate;
    }

    //////////////////////// SILO: TOTALS ////////////////////////

    /**
     * @notice Returns the total supply of Stalk. Does NOT include Grown Stalk.
     */
    function totalStalk() external view returns (uint256) {
        return s.s.stalk;
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingStalkAndRootsForSeason(uint32 season) external view returns (uint256, uint256) {
        return (s.unclaimedGerminating[season].stalk, s.unclaimedGerminating[season].roots);
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingStalkForSeason(uint32 season) external view returns (uint256) {
        return (s.unclaimedGerminating[season].stalk);
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingRootsForSeason(uint32 season) external view returns (uint256) {
        return (s.unclaimedGerminating[season].roots);
    }

    /**
     * @notice returns the stalk that is currently in the germination process.
     */
    function getTotalGerminatingStalk() external view returns (uint256) {
        return s.unclaimedGerminating[s.season.current].stalk.add(
            s.unclaimedGerminating[s.season.current - 1].stalk
        );
    }

    /**
     * @notice returns the young and mature germinating stalk. 
     * `young` germinating stalk are stalk that recently started the germination process.
     * (created in the current season)
     * `mature` germinating stalk are stalk that are paritially germinated,
     * and will finish germinating upon the next sunrise call.
     * (created in the previous season)
     */
    function getYoungAndMatureGerminatingTotalStalk() external view returns (
        uint256 matureGerminatingStalk, uint256 youngGerminatingStalk
    ) {
        return (
            s.unclaimedGerminating[s.season.current - 1].stalk, 
            s.unclaimedGerminating[s.season.current].stalk
        ) ;
    }

    /**
     * @notice gets the total amount germinating for a given `token`.
     */
    function getTotalGerminatingAmount(address token) external view returns (uint256) {
        return s.oddGerminating.deposited[token].amount.add(
            s.evenGerminating.deposited[token].amount
        );
    }

    /**
     * @notice gets the total amount of bdv germinating for a given `token`.
     */
    function getTotalGerminatingBdv(address token) external view returns (uint256) {
        return s.oddGerminating.deposited[token].bdv.add(
            s.evenGerminating.deposited[token].bdv
        );
    }
    
    /**
     * @notice gets the odd germinating amount and bdv for a given `token`.
     */
    function getOddGerminating(address token) external view returns (uint256, uint256) {
        return(
            s.oddGerminating.deposited[token].amount, 
            s.oddGerminating.deposited[token].bdv
        );
    }

    /**
     * @notice gets the even germinating amount and bdv for a given `token`.
     */
    function getEvenGerminating(address token) external view returns (uint256, uint256) {
        return(
            s.evenGerminating.deposited[token].amount, 
            s.evenGerminating.deposited[token].bdv
        );
    }

    /**
     * @notice returns the amount of stalk that will finish germinating upon a silo interaction.
     */
    function balanceOfFinishedGerminatingStalkAndRoots(
        address account
    ) external view returns (uint256 gStalk, uint256 gRoots) {
        (gStalk, gRoots) = LibGerminate.getFinishedGerminatingStalkAndRoots(
            account,
            s.a[account].lastUpdate,
            s.season.current
        );
    }

    /**
     * @notice Returns the total supply of Roots.
     */
    function totalRoots() external view returns (uint256) {
        return s.s.roots;
    }

    /**
     * @notice Returns the total supply of Earned Beans.
     * @dev Beanstalk's "supply" of Earned Beans is a subset of the total Bean
     * supply. Earned Beans are simply seignorage Beans held by Beanstalk for 
     * distribution to Stalkholders during {SiloFacet-plant}.   
     */
    function totalEarnedBeans() external view returns (uint256) {
        return s.earnedBeans;
    }

    //////////////////////// SILO: ACCOUNT BALANCES ////////////////////////

    /**
     * @notice Returns the balance of Stalk for `account`. 
     * Does NOT include Grown Stalk.
     * DOES include Earned Stalk.
     * DOES include Germinating Stalk that will end germination 
     * upon a silo interaction.
     * @dev Earned Stalk earns Bean Mints, but Grown Stalk does not due to
     * computational complexity.
     */
    function balanceOfStalk(address account) external view returns (uint256) {
        (uint256 germinatingStalk, ) = LibGerminate.getFinishedGerminatingStalkAndRoots(
            account,
            s.a[account].lastUpdate,
            s.season.current
        );
        return s.a[account].s.stalk
            .add(germinatingStalk)
            .add(balanceOfEarnedStalk(account));
    }

    /**
     * @notice Returns the balance of Germinating Stalk for `account`.
     * @dev Germinating Stalk that will finish germination upon a silo interaction
     * is not included.
     */
    function balanceOfGerminatingStalk(address account) external view returns (uint256) {
        return LibGerminate.getCurrentGerminatingStalk(
            account,
            s.a[account].lastUpdate
        );
    }

    /**
     * @notice returns the amount of young and mature germinating stalk that an account has.
     * `young` germinating stalk are the most recent germinating stalk issued to `account`.
     * `mature` germinating stalk are germinating stalk that are paritially germinated.
     * @dev both `young` and `old stalk here may have already finished the germination process
     * but require a silo interaction to update.
     */
    function balanceOfYoungAndMatureGerminatingStalk(
        address account
    ) external view returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk) {
        // if the last mowed season is less than the current season - 1,
        // then there are no germinating stalk and roots (as all germinating assets have finished).
        if (s.a[account].lastUpdate < s.season.current - 1) {
            return (0, 0);
        } else {
            (youngGerminatingStalk, matureGerminatingStalk) = LibGerminate.getGerminatingStalk(
                account,
                LibGerminate.isSeasonOdd(s.a[account].lastUpdate)
            );
        }
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
     * When a Flood occurs, Plenty is distributed based on a Farmer's balance 
     * of Roots when it started Raining.
     */
    function balanceOfRoots(address account) external view returns (uint256) {
        (, uint256 germinatingRoots) = LibGerminate.getFinishedGerminatingStalkAndRoots(
            account,
            s.a[account].lastUpdate,
            s.season.current
        );
        return s.a[account].roots.add(germinatingRoots);
    }

    /**
     * @notice Returns the balance of Grown Stalk for `account`. Grown Stalk is 
     * earned each Season from BDV and must be Mown via `SiloFacet-mow` to 
     * apply it to a user's balance.
     * 
     * @dev This passes in the last stem the user mowed at and the current stem
     */
    function balanceOfGrownStalk(address account, address token)
        external
        view
        returns (uint256)
    {
        return
            LibSilo._balanceOfGrownStalk(
                s.a[account].mowStatuses[token].lastStem, //last stem farmer mowed
                LibTokenSilo.stemTipForToken(token), //get latest stem for this token
                s.a[account].mowStatuses[token].bdv
            );
    }

    /**
     * @notice Returns the balance of Grown Stalk for a single deposit of `token`
     * in `stem` for `account`. Grown Stalk is earned each Season from BDV and
     * must be Mown via `SiloFacet-mow` to apply it to a user's balance.
     *
     * @dev This passes in the last stem the user mowed at and the current stem
     */
    function grownStalkForDeposit(
        address account,
        address token,
        int96 stem
    )
        external
        view
        returns (uint grownStalk)
    {
        return LibTokenSilo.grownStalkForDeposit(account, token, stem);
    }
    
    /**
     * @notice Returns the balance of Earned Beans for `account`. Earned Beans
     * are the Beans distributed to Stalkholders during {Sun-rewardToSilo}.
     */
    function balanceOfEarnedBeans(address account)
        public
        view
        returns (uint256 beans)
    {
        (uint256 germinatingStalk, uint256 germinatingRoots) = LibGerminate.getFinishedGerminatingStalkAndRoots(
            account,
            s.a[account].lastUpdate,
            s.season.current
        );
        uint256 accountStalk = s.a[account].s.stalk.add(germinatingStalk);
        uint256 accountRoots = s.a[account].roots.add(germinatingRoots);
        beans = LibSilo._balanceOfEarnedBeans(accountStalk, accountRoots);
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
        return balanceOfEarnedBeans(account).mul(C.STALK_PER_BEAN);
    }

    /**
     * @notice Return the balance of Deposited BDV of `token` for a given `account`.
     */
    function balanceOfDepositedBdv(address account, address token)
        external
        view
        returns (uint256 depositedBdv)
    {
        depositedBdv = s.a[account].mowStatuses[token].bdv;
    }

    /**
     * @notice Return the Stem at the time that `account` last mowed `token`.
     */
    function getLastMowedStem(address account, address token)
        external
        view
        returns (int96 lastStem)
    {
        lastStem = s.a[account].mowStatuses[token].lastStem;
    }

    /**
     * @notice Return the Mow Status of `token` for a given `account`.
     * Mow Status includes the Stem at the time that `account` last mowed `token`
     * and the balance of Deposited BDV of `token` for `account`.
     */
    function getMowStatus(address account, address token)
        external
        view
        returns (Account.MowStatus memory mowStatus)
    {
        mowStatus = s.a[account].mowStatuses[token];
    }

    //////////////////////// SEASON OF PLENTY ////////////////////////

    /**
     * @notice Returns the last Season that it started Raining resulting in a 
     * Season of Plenty.
     */
    function lastSeasonOfPlenty() external view returns (uint32) {
        return s.season.lastSop;
    }

    /**
     * @notice Returns the `account` balance of unclaimed BEAN:3CRV earned from 
     * Seasons of Plenty.
     */
    function balanceOfPlenty(address account)
        external
        view
        returns (uint256 plenty)
    {
        return LibSilo.balanceOfPlenty(account);
    }

    /**
     * @notice Returns the `account` balance of Roots the last time it was 
     * Raining during a Silo update.
     */
    function balanceOfRainRoots(address account) external view returns (uint256) {
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
        sop.plenty = LibSilo.balanceOfPlenty(account);
        sop.plentyPerRoot = s.a[account].sop.plentyPerRoot;
    }

    //////////////////////// STEM ////////////////////////

    /**
     * @notice Returns the "stemTip" for a given token.
     * @dev the stemTip is the Cumulative Grown Stalk Per BDV 
     * of a given deposited asset since whitelist. 
     * 
     * note that a deposit for a given asset may have 
     * a higher Grown Stalk Per BDV than the stemTip.
     * 
     * This can occur when a deposit is converted from an asset
     * with a larger seeds per BDV, to a lower seeds per BDV.
     */
    function stemTipForToken(address token)
        external
        view
        returns (int96 _stemTip)
    {
        _stemTip = LibTokenSilo.stemTipForToken(
            token
        );
    }

    /**
     * @notice given the season/token, returns the stem assoicated with that deposit.
     * kept for legacy reasons. 
     */
    function seasonToStem(address token, uint32 season)
        external
        view
        returns (int96 stem)
    {
        uint256 seedsPerBdv = getLegacySeedsPerToken(token).mul(1e6);
        stem = LibLegacyTokenSilo.seasonToStem(seedsPerBdv, season);
    }

    /**
     * @notice returns the seeds per token, for legacy tokens.
     * calling with an non-legacy token will return 0, 
     * even after the token is whitelisted.
     * kept for legacy reasons. 
     */
    function getLegacySeedsPerToken(address token) public view virtual returns (uint256) {
        return LibLegacyTokenSilo.getLegacySeedsPerToken(token);
    }

    /**
     * @notice returns the season in which beanstalk initalized siloV3.
     */
    function stemStartSeason() external view virtual returns (uint16) {
        return s.season.stemStartSeason;
    }

    /**
     * @notice returns whether an account needs to migrate to siloV3.
     */
    function migrationNeeded(address account) external view returns (bool hasMigrated) {
        (hasMigrated, ) = LibSilo.migrationNeeded(account);
    }

    //////////////////////// INTERNAL ////////////////////////

    /**
     * @notice Returns the current Season number.
     */
    function _season() internal view returns (uint32) {
        return s.season.current;
    }

}
