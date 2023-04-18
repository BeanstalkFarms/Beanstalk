/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "./LibSilo.sol";
import "./LibUnripeSilo.sol";
import "../LibAppStorage.sol";
import {LibSafeMathSigned128} from "~/libraries/LibSafeMathSigned128.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibBytes} from "~/libraries/LibBytes.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

/**
 * @title LibLegacyTokenSilo
 * @author Publius
 * @notice Contains functions for depositing, withdrawing and claiming
 * whitelisted Silo tokens.
 *
 * For functionality related to Seeds, Stalk, and Roots, see {LibSilo}.
 */
library LibLegacyTokenSilo {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMathSigned128 for int128;
    using LibSafeMathSigned96 for int96;


    //important to note that this event is only here for unit tests purposes of legacy code and to ensure unripe all works with new bdv system
    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    );

    //this is the legacy seasons-based remove deposits event, emitted on migration
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    //legacy seeds balanced changed event, used upon migration
    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    //legacy stalk balanced changed event, used upon migration
    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

    /// @dev these events are grandfathered for claiming deposits. 
    event RemoveWithdrawals(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256 amount
    );
    event RemoveWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    struct MigrateData {
        uint128 totalSeeds;
        uint128 totalGrownStalk;
    }

    struct PerDepositData {
        uint32 season;
        uint128 amount;
        uint128 grownStalk;
    }

    struct PerTokenData {
        address token;
        int96 stemTip;
    }

    //////////////////////// REMOVE DEPOSIT ////////////////////////

    /**
     * @dev Remove `amount` of `token` from a user's Deposit in `season`.
     *
     * A "Crate" refers to the existing Deposit in storage at:
     *  `s.a[account].legacyDeposits[token][season]`
     *
     * Partially removing a Deposit should scale its BDV proportionally. For ex.
     * removing 80% of the tokens from a Deposit should reduce its BDV by 80%.
     *
     * During an update, `amount` & `bdv` are cast uint256 -> uint128 to
     * optimize storage cost, since both values can be packed into one slot.
     *
     * This function DOES **NOT** EMIT a {RemoveDeposit} event. This
     * asymmetry occurs because {removeDepositFromAccount} is called in a loop
     * in places where multiple deposits are removed simultaneously, including
     * {TokenSilo-removeDepositsFromAccount} and {TokenSilo-_transferDeposits}.
     */
    function removeDepositFromAccount(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256 crateBDV) {
        
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 crateAmount;
        (crateAmount, crateBDV) = (
            s.a[account].legacyDeposits[token][season].amount,
            s.a[account].legacyDeposits[token][season].bdv
        );

        // Partial remove
        if (amount < crateAmount) {
            uint256 removedBDV = amount.mul(crateBDV).div(crateAmount);
            uint256 updatedBDV = uint256(
                s.a[account].legacyDeposits[token][season].bdv
            ).sub(removedBDV);
            uint256 updatedAmount = uint256(
                s.a[account].legacyDeposits[token][season].amount
            ).sub(amount);

            require(
                updatedBDV <= uint128(-1) && updatedAmount <= uint128(-1),
                "Silo: uint128 overflow."
            );

            s.a[account].legacyDeposits[token][season].amount = uint128(
                updatedAmount
            );
            s.a[account].legacyDeposits[token][season].bdv = uint128(
                updatedBDV
            );

            return removedBDV;
        }

        // Full remove
        if (crateAmount > 0) delete s.a[account].legacyDeposits[token][season];

        // Excess remove
        // This can only occur for Unripe Beans and Unripe LP Tokens, and is a
        // result of using Silo V1 storage slots to store Unripe BEAN/LP
        // Deposit information. See {AppStorage.sol:Account-State}.
        if (amount > crateAmount) {
            amount -= crateAmount;
            if (LibUnripeSilo.isUnripeBean(token))
                return
                    crateBDV.add(
                        LibUnripeSilo.removeUnripeBeanDeposit(
                            account,
                            season,
                            amount
                        )
                    );
            else if (LibUnripeSilo.isUnripeLP(token))
                return
                    crateBDV.add(
                        LibUnripeSilo.removeUnripeLPDeposit(
                            account,
                            season,
                            amount
                        )
                    );
            revert("Silo: Crate balance too low.");
        }
    }

    //////////////////////// GETTERS ////////////////////////


    /**
     * @notice Returns the balance of Grown Stalk for `account` up until the
     * Stems deployment season.
     * @dev The balance of Grown Stalk for an account can be calculated as:
     *
     * ```
     * elapsedSeasons = currentSeason - lastUpdatedSeason
     * grownStalk = balanceOfSeeds * elapsedSeasons
     * ```
     */
    function balanceOfGrownStalkUpToStemsDeployment(address account)
        internal
        view
        returns (uint256)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint32 stemStartSeason = uint32(s.season.stemStartSeason);

        return
            stalkReward(
                s.a[account].s.seeds,
                s.a[account].lastUpdate-stemStartSeason
            );
    }

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

    /** 
     * @notice Determines if the given stem corresponds to a seasons-based deposit
     * @param seedsPerBdv Seeds per bdv for the token you want to see if the stem corresponds
     * to a seasons-based deposit for
     * @param season The season you want to to see if the stem corresponds to a seasons-based deposit
     *
     * @dev This function was used when support for accessing old deposits without requiring migration
     * was supported, after support was removed this function is no longer necessary.
     */
    /*function isDepositSeason(uint256 seedsPerBdv, int96 stem)
        internal
        pure
        returns (bool)
    {
        if (seedsPerBdv == 0) {
            return false; //shortcut since we know it's a newer token?
        }
        
        return
            stem <= 0 && //old deposits in seasons will have a negative grown stalk per bdv
            uint256(-stem) % seedsPerBdv == 0;
    }*/

    /** 
     * @notice Calculates stem based on input season
     * @param seedsPerBdv Seeds per bdv for the token you want to find the corresponding stem for
     * @param season The season you want to find the corresponding stem for
     *
     * @dev Used by the mowAndMigrate function to convert seasons to stems, to know which
     * stem to deposit in for the new Silo storage system.
     */
    function seasonToStem(uint256 seedsPerBdv, uint32 season)
        internal
        view
        returns (int96 stem)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        require(seedsPerBdv > 0, "Silo: Token not supported");

        //need to go back in time, calculate the delta between the current season and that old deposit season,
        //and that's how many seasons back we need to go. Then, multiply that by seedsPerBdv, and that's our
        //negative grown stalk index.

        //find the difference between the input season and the Silo v3 epoch season
        //using regular - here because we want it to overflow negative
        stem = (int96(season)-int96(s.season.stemStartSeason)).mul(int96(seedsPerBdv));
    }

    //this function was used for some testing at some point, but there are currently
    //no unit tests that use it. Leaving it here for now in case we need it later.
    // function stemToSeason(uint256 seedsPerBdv, int128 stem)
    //     internal
    //     view
    //     returns (uint32 season)
    // {
    //     // require(stem > 0);
    //     AppStorage storage s = LibAppStorage.diamondStorage();
    //     // uint256 seedsPerBdv = getSeedsPerToken(address(token));

    //     require(seedsPerBdv > 0, "Silo: Token not supported");

    //     int128 diff = stem.div(int128(seedsPerBdv));
    //     //using regular + here becauase we want to "overflow" (which for signed just means add negative)
    //     season = uint256(int128(s.season.stemStartSeason)+diff).toUint32();
    //     // season = seasonAs256.toUint32();
    // }

    /** 
     * @notice Migrates farmer's deposits from old (seasons based) to new silo (stems based).
     * @param account Address of the account to migrate
     *
     * @dev If a user's lastUpdate was set, which means they previously had deposits in the silo.
     * if they currently do not have any deposits to migrate, then this function 
     * can be used to migrate their account to the new silo cheaply.
     */
   function _migrateNoDeposits(address account) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(s.a[account].s.seeds == 0, "only for zero seeds");
        
        require(LibSilo.migrationNeeded(account), "no migration needed");

        s.a[account].lastUpdate = s.season.stemStartSeason;
    }


    /** 
     * @notice Migrates farmer's deposits from old (seasons based) to new silo (stems based).
     * @param account Address of the account to migrate
     * @param tokens Array of tokens to migrate
     * @param seasons The seasons in which the deposits were made
     * @param amounts The amounts of those deposits which are to be migrated
     *
     * @dev When migrating an account, you must submit all of the account's deposits,
     * or the migration will not pass because the seed check will fail. The seed check
     * adds up the BDV of all submitted deposits, and multiples by the corresponding
     * seed amount for each token type, then compares that to the total seeds stored for that user.
     * If everything matches, we know all deposits were submitted, and the migration is valid.
     *
     * Deposits are migrated to the stem storage system on a 1:1 basis. Accounts with
     * lots of deposits may take a considerable amount of gas to migrate.
     * 
     * Returns seeds diff compared to stored amount, for verification in merkle check.
     */
    function _mowAndMigrate(
        address account, 
        address[] calldata tokens, 
        uint32[][] calldata seasons,
        uint256[][] calldata amounts
    ) internal returns (uint256) {
        //typically a migrationNeeded should be enough to allow the user to migrate, however
        //for Unripe unit testing convenience, (Update Unripe Deposit -> "1 deposit, some", 
        //"1 deposit after 1 season, all", and "2 deposit, all" tests), they cannot migrate
        //since the test expects to add a Legacy deposit (which updates lastUpdated) and
        //migrate in the same season, which doesn't work since lastUpdated is updated
        //on deposit. By allow migration if balanceOfSeeds > 0, everything works smoothly.
        //You would never be able to migrate twice since the old deposits would be removed already,
        //and balanceOfSeeds would be 0 on 2nd migration attempt.
        require((LibSilo.migrationNeeded(account) || balanceOfSeeds(account) > 0), "no migration needed");


        //do a legacy mow using the old silo seasons deposits
        updateLastUpdateToNow(account);
        LibSilo.mintGrownStalk(account, balanceOfGrownStalkUpToStemsDeployment(account)); //should only mint stalk up to stemStartSeason
        //at this point we've completed the guts of the old mow function, now we need to do the migration
 
        MigrateData memory migrateData;
 
        // use of PerTokenData and PerDepositData structs to save on stack depth
        for (uint256 i = 0; i < tokens.length; i++) {
            PerTokenData memory perTokenData;
            perTokenData.token = tokens[i];
            perTokenData.stemTip = LibTokenSilo.stemTipForToken(perTokenData.token);
 
            for (uint256 j = 0; j < seasons[i].length; j++) {
                PerDepositData memory perDepositData;
                perDepositData.season = seasons[i][j];
                perDepositData.amount = uint128(amounts[i][j]);
 
                if (perDepositData.amount == 0) {
                    // skip deposit calculations if amount deposited in deposit is 0
                    continue;
                }
 
                // withdraw this deposit
                uint256 crateBDV = removeDepositFromAccount(
                                    account,
                                    perTokenData.token,
                                    perDepositData.season,
                                    perDepositData.amount
                                );
 
                //calculate how much stalk has grown for this deposit
                perDepositData.grownStalk = _calcGrownStalkForDeposit(
                    crateBDV * getSeedsPerToken(address(perTokenData.token)),
                    perDepositData.season
                );
 
                // also need to calculate how much stalk has grown since the migration
                uint128 stalkGrownSinceStemStartSeason = uint128(LibSilo.stalkReward(0, perTokenData.stemTip, uint128(crateBDV)));
                perDepositData.grownStalk += stalkGrownSinceStemStartSeason;
                migrateData.totalGrownStalk += stalkGrownSinceStemStartSeason;
 
                // add to new silo
                LibTokenSilo.addDepositToAccount(
                    account, 
                    perTokenData.token, 
                    LibTokenSilo.grownStalkAndBdvToStem(
                        IERC20(perTokenData.token), 
                        perDepositData.grownStalk,
                        crateBDV
                    ), 
                    perDepositData.amount, 
                    crateBDV,
                    LibTokenSilo.Transfer.emitTransferSingle
                );
 
                // add to running total of seeds
                migrateData.totalSeeds += uint128(uint256(crateBDV) * getSeedsPerToken(address(perTokenData.token)));

                // emit legacy RemoveDeposit event
                emit RemoveDeposit(account, perTokenData.token, perDepositData.season, perDepositData.amount);
            }
 
            // init mow status for this token
            setMowStatus(account, perTokenData.token, perTokenData.stemTip);
        }
 
        // user deserves stalk grown between stemStartSeason and now
        LibSilo.mintGrownStalk(account, migrateData.totalGrownStalk);

        //return seeds diff for checking in the "part 2" of this function (stack depth kept it from all fitting in one)
        return balanceOfSeeds(account).sub(migrateData.totalSeeds);
    }

    function _mowAndMigrateMerkleCheck(
        address account,
        uint256 stalkDiff,
        uint256 seedsDiff,
        bytes32[] calldata proof,
        uint256 seedsVariance
    ) internal {
        if (seedsDiff > 0) {
            //read merkle root to determine stalk/seeds diff drift from convert issue
            //TODO: verify and update this root on launch if there's more drift
            //to get the new root, run `node scripts/silov3-merkle/stems_merkle.js`
            bytes32 root = 0xb81b71efcfb245c4d596e20e403b2a6f70c05c68f59a5e57083881eacacc9671;
            bytes32 leaf = keccak256(abi.encode(account, stalkDiff, seedsDiff));
            
            require(
                MerkleProof.verify(proof, root, leaf),
                "UnripeClaim: invalid proof"
            );
        }
        
        //make sure seedsVariance equals seedsDiff input
        require(seedsVariance == seedsDiff, "seeds misalignment, double check submitted deposits");

        AppStorage storage s = LibAppStorage.diamondStorage();


        //and wipe out old seed balances (all your seeds are belong to stem)
        setBalanceOfSeeds(account, 0);

        //emit that all their seeds are gone
        emit SeedsBalanceChanged(account, -int256(s.a[account].s.seeds));

        //emit the stalk variance
        emit StalkBalanceChanged(account, -int256(stalkDiff), 0);
    }

    /**
     * @dev Updates the lastStem of a given token for an account to the latest Tip.
     */
    function setMowStatus(address account, address token, int96 stemTip) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].mowStatuses[token].lastStem = stemTip;
    }

    /**
     * @dev Season getter.
     */
    function _season() internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.season.current;
    }

    /**
     * @notice DEPRECATED: Seeds do not exist in the new system, but will remain as a
     * user facing concept for the time being.
     * 
     * @dev Legacy Seed balance getter.
     * 
     */
    function balanceOfSeeds(address account) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].s.seeds;
    }

    /**
     * @notice DEPRECATED: Seeds do not exist in the new system,
     * but will remain as a user facing concept for the time being.
     * 
     * @dev sets the seed for an given account.
     * 
     */
    function setBalanceOfSeeds(address account, uint256 seeds) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].s.seeds = seeds;
    }

    /**
     * @dev Updates `lastUpdate` of an account to the current season.
     */
    function updateLastUpdateToNow(address account) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.a[account].lastUpdate = _season();
    }

    /**
     * @dev Calculates the amount of stalk thats been grown for a given deposit.
     */
    function _calcGrownStalkForDeposit(
        uint256 seedsForDeposit,
        uint32 season
    ) internal view returns (uint128 grownStalk) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint32 stemStartSeason = uint32(s.season.stemStartSeason);
        return uint128(stalkReward(seedsForDeposit, stemStartSeason - season));
    }

    /**
     * @dev Legacy Seed balance getter.
     * 
     * constants are used in favor of reading from storage for gas savings.
     */
    function getSeedsPerToken(address token) internal pure returns (uint256) {
        if (token == C.beanAddress()) {
            return 2;
        } else if (token == C.unripeBeanAddress()) {
            return 2;
        } else if (token == C.unripeLPAddress()) {
            return 4;
        } else if (token == C.curveMetapoolAddress()) {
            return 4;
        }
        return 0;
    }

    ////////////////////////// CLAIM ///////////////////////////////

    /** 
     * @notice DEPRECATED. Internal logic for claiming a singular deposit.
     * 
     * @dev The Zero Withdraw update removed the two-step withdraw & claim process. 
     * These internal functions are left for backwards compatibility, to allow pending 
     * withdrawals from before the update to be claimed.
     */
    function _claimWithdrawal(
        address account,
        address token,
        uint32 season
    ) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 amount = _removeTokenWithdrawal(account, token, season);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawal(msg.sender, token, season, amount);
        return amount;
    }

    /** 
     * @notice DEPRECATED. Internal logic for claiming multiple deposits.
     * 
     * @dev The Zero Withdraw update removed the two-step withdraw & claim process. 
     * These internal functions are left for backwards compatibility, to allow pending 
     * withdrawals from before the update to be claimed.
     */
    function _claimWithdrawals(
        address account,
        address token,
        uint32[] calldata seasons
    ) internal returns (uint256 amount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        for (uint256 i; i < seasons.length; ++i) {
            amount = amount.add(
                _removeTokenWithdrawal(account, token, seasons[i])
            );
        }
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawals(msg.sender, token, seasons, amount);
        return amount;
    }

    /** 
     * @notice DEPRECATED. Internal logic for removing the claim multiple deposits.
     * 
     * @dev The Zero Withdraw update removed the two-step withdraw & claim process. 
     * These internal functions are left for backwards compatibility, to allow pending 
     * withdrawals from before the update to be claimed.
     */
    function _removeTokenWithdrawal(
        address account,
        address token,
        uint32 season
    ) private returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(
            season <= s.season.current,
            "Claim: Withdrawal not receivable"
        );
        uint256 amount = s.a[account].withdrawals[token][season];
        delete s.a[account].withdrawals[token][season];
        return amount;
    }
}
