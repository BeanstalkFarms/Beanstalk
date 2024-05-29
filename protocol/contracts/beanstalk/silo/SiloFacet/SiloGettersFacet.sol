/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Deposit} from "contracts/beanstalk/storage/Account.sol";
import {GerminationSide} from "contracts/beanstalk/storage/System.sol";
import {MowStatus} from "contracts/beanstalk/storage/Account.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {LibRedundantMath128} from "contracts/libraries/LibRedundantMath128.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibSilo} from "contracts/libraries/Silo/LibSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {C} from "contracts/C.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {PerWellPlenty} from "contracts/beanstalk/storage/Account.sol";
import {LibFlood} from "contracts/libraries/Silo/LibFlood.sol";

/**
 * @author Brean, pizzaman1337
 * @title SiloGettersFacet contains view functions related to the silo.
 **/
contract SiloGettersFacet is ReentrancyGuard {
    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;

    /**
     * @notice TokenDepositId contains the DepositsIds for a given token.
     */
    struct TokenDepositId {
        address token;
        uint256[] depositIds;
        Deposit[] tokenDeposits;
    }

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
        FarmerSops[] farmerSops;
    }

    struct FarmerSops {
        address well;
        PerWellPlenty wellsPlenty;
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
        return s.sys.silo.balances[token].deposited;
    }

    /**
     * @notice Get the total bdv of `token` currently Deposited in the Silo across all users.
     * @dev does not include germinating bdv.
     */
    function getTotalDepositedBdv(address token) external view returns (uint256) {
        return s.sys.silo.balances[token].depositedBdv;
    }

    /**
     * @notice returns the germinating deposited amount of `token` for the current season.
     */
    function getGerminatingTotalDeposited(address token) external view returns (uint256 amount) {
        (, amount) = LibGerminate.getTotalGerminatingForToken(token);
    }

    /**
     * @notice returns the germinating deposited bdv of `token` for the current season.
     */
    function getGerminatingTotalDepositedBdv(address token) external view returns (uint256 _bdv) {
        (_bdv, ) = LibGerminate.getTotalGerminatingForToken(token);
    }

    /**
     * @notice Get the AssetSettings for a whitelisted Silo token.
     *
     * Contains:
     *  - the BDV function selector
     *  - Stalk per BDV
     *  - stalkEarnedPerSeason
     *  - milestoneSeason
     *  - lastStem
     */
    function tokenSettings(address token) external view returns (AssetSettings memory) {
        return s.sys.silo.assetSettings[token];
    }

    //////////////////////// ERC1155 ////////////////////////

    /**
     * @notice returns the amount of tokens in a Deposit.
     *
     * @dev see {getDeposit} for both the bdv and amount.
     */
    function balanceOf(address account, uint256 depositId) external view returns (uint256 amount) {
        return s.accts[account].deposits[depositId].amount;
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
            balances[i] = s.accts[accounts[i]].deposits[depositIds[i]].amount;
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
    function bdv(address token, uint256 amount) external view returns (uint256 _bdv) {
        _bdv = LibTokenSilo.beanDenominatedValue(token, amount);
    }

    //////////////////////// UTILTIES ////////////////////////

    /**
     * @notice Get the last Season in which `account` updated their Silo.
     */
    function lastUpdate(address account) external view returns (uint32) {
        return s.accts[account].lastUpdate;
    }

    //////////////////////// SILO: TOTALS ////////////////////////

    /**
     * @notice Returns the total supply of Stalk. Does NOT include Grown Stalk.
     */
    function totalStalk() external view returns (uint256) {
        return s.sys.silo.stalk;
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingStalkAndRootsForSeason(
        uint32 season
    ) external view returns (uint256, uint256) {
        return (
            s.sys.silo.unclaimedGerminating[season].stalk,
            s.sys.silo.unclaimedGerminating[season].roots
        );
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingStalkForSeason(uint32 season) external view returns (uint256) {
        return (s.sys.silo.unclaimedGerminating[season].stalk);
    }

    /**
     * @notice Returns the unclaimed germinating stalk and roots for a season.
     */
    function getGerminatingRootsForSeason(uint32 season) external view returns (uint256) {
        return (s.sys.silo.unclaimedGerminating[season].roots);
    }

    /**
     * @notice returns the stalk that is currently in the germination process.
     */
    function getTotalGerminatingStalk() external view returns (uint256) {
        return
            s.sys.silo.unclaimedGerminating[s.sys.season.current].stalk.add(
                s.sys.silo.unclaimedGerminating[s.sys.season.current - 1].stalk
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
    function getYoungAndMatureGerminatingTotalStalk()
        external
        view
        returns (uint256 matureGerminatingStalk, uint256 youngGerminatingStalk)
    {
        return (
            s.sys.silo.unclaimedGerminating[s.sys.season.current - 1].stalk,
            s.sys.silo.unclaimedGerminating[s.sys.season.current].stalk
        );
    }

    /**
     * @notice gets the total amount germinating for a given `token`.
     */
    function getTotalGerminatingAmount(address token) external view returns (uint256) {
        return
            s.sys.silo.germinating[GerminationSide.ODD][token].amount +
            s.sys.silo.germinating[GerminationSide.EVEN][token].amount;
    }

    /**
     * @notice gets the total amount of bdv germinating for a given `token`.
     */
    function getTotalGerminatingBdv(address token) external view returns (uint256) {
        return
            s.sys.silo.germinating[GerminationSide.ODD][token].bdv +
            s.sys.silo.germinating[GerminationSide.EVEN][token].bdv;
    }

    /**
     * @notice gets the odd germinating amount and bdv for a given `token`.
     */
    function getOddGerminating(address token) external view returns (uint256, uint256) {
        return (
            s.sys.silo.germinating[GerminationSide.ODD][token].amount,
            s.sys.silo.germinating[GerminationSide.ODD][token].bdv
        );
    }

    /**
     * @notice gets the even germinating amount and bdv for a given `token`.
     */
    function getEvenGerminating(address token) external view returns (uint256, uint256) {
        return (
            s.sys.silo.germinating[GerminationSide.EVEN][token].amount,
            s.sys.silo.germinating[GerminationSide.EVEN][token].bdv
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
            s.accts[account].lastUpdate,
            s.sys.season.current
        );
    }

    /**
     * @notice Returns the total supply of Roots.
     */
    function totalRoots() external view returns (uint256) {
        return s.sys.silo.roots;
    }

    /**
     * @notice Returns the total supply of Earned Beans.
     * @dev Beanstalk's "supply" of Earned Beans is a subset of the total Bean
     * supply. Earned Beans are simply seignorage Beans held by Beanstalk for
     * distribution to Stalkholders during {SiloFacet-plant}.
     */
    function totalEarnedBeans() external view returns (uint256) {
        return s.sys.silo.earnedBeans;
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
            s.accts[account].lastUpdate,
            s.sys.season.current
        );
        return s.accts[account].stalk.add(germinatingStalk).add(balanceOfEarnedStalk(account));
    }

    /**
     * @notice Returns the balance of Germinating Stalk for `account`.
     * @dev Germinating Stalk that will finish germination upon a silo interaction
     * is not included.
     */
    function balanceOfGerminatingStalk(address account) external view returns (uint256) {
        return LibGerminate.getCurrentGerminatingStalk(account, s.accts[account].lastUpdate);
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
        if (s.accts[account].lastUpdate < s.sys.season.current - 1) {
            return (0, 0);
        } else {
            (youngGerminatingStalk, matureGerminatingStalk) = LibGerminate.getGerminatingStalk(
                account,
                LibGerminate.isSeasonOdd(s.accts[account].lastUpdate)
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
            s.accts[account].lastUpdate,
            s.sys.season.current
        );
        return s.accts[account].roots.add(germinatingRoots);
    }

    /**
     * @notice Returns the balance of Grown Stalk for `account`. Grown Stalk is
     * earned each Season from BDV and must be Mown via `SiloFacet-mow` to
     * apply it to a user's balance.
     *
     * @dev This passes in the last stem the user mowed at and the current stem
     */
    function balanceOfGrownStalk(address account, address token) external view returns (uint256) {
        return
            LibSilo._balanceOfGrownStalk(
                s.accts[account].mowStatuses[token].lastStem, //last stem farmer mowed
                LibTokenSilo.stemTipForToken(token), //get latest stem for this token
                s.accts[account].mowStatuses[token].bdv
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
    ) external view returns (uint grownStalk) {
        return LibTokenSilo.grownStalkForDeposit(account, token, stem);
    }

    /**
     * @notice Returns the balance of Earned Beans for `account`. Earned Beans
     * are the Beans distributed to Stalkholders during {Sun-rewardToSilo}.
     */
    function balanceOfEarnedBeans(address account) public view returns (uint256 beans) {
        (uint256 germinatingStalk, uint256 germinatingRoots) = LibGerminate
            .getFinishedGerminatingStalkAndRoots(
                account,
                s.accts[account].lastUpdate,
                s.sys.season.current
            );
        uint256 accountStalk = s.accts[account].stalk.add(germinatingStalk);
        uint256 accountRoots = s.accts[account].roots.add(germinatingRoots);
        beans = LibSilo._balanceOfEarnedBeans(accountStalk, accountRoots);
    }

    /**
     * @notice Return the `account` balance of Earned Stalk, the Stalk
     * associated with Earned Beans.
     * @dev Earned Stalk can be derived from Earned Beans because
     * 1 Bean => 1 Stalk. See {C-getStalkPerBean}.
     */
    function balanceOfEarnedStalk(address account) public view returns (uint256) {
        return balanceOfEarnedBeans(account).mul(C.STALK_PER_BEAN);
    }

    /**
     * @notice Return the balance of Deposited BDV of `token` for a given `account`.
     */
    function balanceOfDepositedBdv(
        address account,
        address token
    ) external view returns (uint256 depositedBdv) {
        depositedBdv = s.accts[account].mowStatuses[token].bdv;
    }

    /**
     * @notice Return the Stem at the time that `account` last mowed `token`.
     */
    function getLastMowedStem(
        address account,
        address token
    ) external view returns (int96 lastStem) {
        lastStem = s.accts[account].mowStatuses[token].lastStem;
    }

    /**
     * @notice Return the Mow Status of `token` for a given `account`.
     * Mow Status includes the Stem at the time that `account` last mowed `token`
     * and the balance of Deposited BDV of `token` for `account`.
     */
    function getMowStatus(
        address account,
        address token
    ) external view returns (MowStatus memory mowStatus) {
        mowStatus = s.accts[account].mowStatuses[token];
    }

    //////////////////////// SEASON OF PLENTY ////////////////////////

    /**
     * @notice Returns the last Season that it started Raining resulting in a
     * Season of Plenty.
     */
    function lastSeasonOfPlenty() external view returns (uint32) {
        return s.sys.season.lastSop;
    }

    /**
     * @notice Returns the `account` balance of unclaimed tokens earned from
     * Seasons of Plenty.
     */
    function balanceOfPlenty(address account, address well) external view returns (uint256 plenty) {
        return LibFlood.balanceOfPlenty(account, well);
    }

    /**
     * @notice Returns the `account` balance of Roots the last time it was
     * Raining during a Silo update.
     */
    function balanceOfRainRoots(address account) external view returns (uint256) {
        return s.accts[account].sop.rainRoots;
    }

    /**
     * @notice Returns the `account` Season of Plenty related state variables.
     * @dev See {AccountSeasonOfPlenty} struct.
     */
    function balanceOfSop(
        address account
    ) external view returns (AccountSeasonOfPlenty memory sop) {
        sop.lastRain = s.accts[account].lastRain;
        sop.lastSop = s.accts[account].lastSop;
        sop.roots = s.accts[account].sop.rainRoots;
        address[] memory wells = LibWhitelistedTokens.getWhitelistedWellLpTokens();
        sop.farmerSops = new FarmerSops[](wells.length);
        for (uint256 i; i < wells.length; i++) {
            PerWellPlenty memory wellSop = s.accts[account].sop.perWellPlenty[wells[i]];
            FarmerSops memory farmerSops = FarmerSops(wells[i], wellSop);
            sop.farmerSops[i] = farmerSops;
        }
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
    function stemTipForToken(address token) external view returns (int96 _stemTip) {
        _stemTip = LibTokenSilo.stemTipForToken(token);
    }

    function calculateStemForTokenFromGrownStalk(
        address token,
        uint256 grownStalk,
        uint256 bdvOfDeposit
    ) external view returns (int96 stem, GerminationSide germ) {
        (stem, germ) = LibTokenSilo.calculateStemForTokenFromGrownStalk(
            token,
            grownStalk,
            bdvOfDeposit
        );
    }

    /**
     * @notice returns the season in which beanstalk initalized siloV3.
     */
    function stemStartSeason() external view virtual returns (uint16) {
        return s.sys.season.stemStartSeason;
    }

    //////////////////////// INTERNAL ////////////////////////

    /**
     * @notice Returns the current Season number.
     */
    function _season() internal view returns (uint32) {
        return s.sys.season.current;
    }

    /**
     * @notice returns the deposits for an account for all whitelistedTokens.
     * @notice if a user has no deposits, the function will return an empty array.
     */
    function getDepositsForAccount(
        address account
    ) external view returns (TokenDepositId[] memory deposits) {
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedTokens();
        deposits = new TokenDepositId[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            deposits[i] = getTokenDepositsForAccount(account, tokens[i]);
        }
    }

    /**
     * @notice returns an array of deposits for a given account and token.
     */
    function getTokenDepositsForAccount(
        address account,
        address token
    ) public view returns (TokenDepositId memory deposits) {
        uint256[] memory depositIds = s.accts[account].depositIdList[token];
        if (depositIds.length == 0) return TokenDepositId(token, depositIds, new Deposit[](0));
        deposits.token = token;
        deposits.depositIds = depositIds;
        deposits.tokenDeposits = new Deposit[](depositIds.length);
        for (uint256 i; i < depositIds.length; i++) {
            deposits.tokenDeposits[i] = s.accts[account].deposits[depositIds[i]];
        }
    }

    /**
     * @notice returns the DepositList for a given account and token.
     */
    function getTokenDepositIdsForAccount(
        address account,
        address token
    ) public view returns (uint256[] memory depositIds) {
        return s.accts[account].depositIdList[token];
    }
}
