/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../C.sol";
import "./LibSilo.sol";
import "./LibUnripeSilo.sol";
import "../LibAppStorage.sol";
import {LibSafeMathSigned128} from "contracts/libraries/LibSafeMathSigned128.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

/**
 * @title LibLegacyTokenSilo
 * @author Publius, pizzaman1337
 * @notice Contains legacy silo logic, used for migrating to the
 * new SiloV3 stems-based system, and for claiming in-flight withdrawals
 * from the old silo system.
 * 
 * After all Silos are migrated to V3 and all deposits are claimed, this 
 * library should no longer be necessary.
 */
library LibLegacyTokenSilo {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMathSigned128 for int128;
    using LibSafeMathSigned96 for int96;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;

    //to get the new root, run `node scripts/silov3-merkle/stems_merkle.js`
    bytes32 constant DISCREPANCY_MERKLE_ROOT = 0xa84dc86252c556839dff46b290f0c401088a65584aa38a163b6b3f7dd7a5b0e8;
    uint32 constant ENROOT_FIX_SEASON = 12793; //season in which enroot ebip-8 fix was deployed


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

        // If amount to remove is greater than the amount in the Deposit, migrate legacy Deposit to new Deposit
        if (amount > crateAmount) {
            // If Unripe Deposit, fetch whole Deposit balance and delete legacy deposit references.
            if (LibUnripeSilo.isUnripeBean(token)) {
                (crateAmount, crateBDV) = LibUnripeSilo.unripeBeanDeposit(account, season);
                LibUnripeSilo.removeLegacyUnripeBeanDeposit(account, season);
            } else if (LibUnripeSilo.isUnripeLP(token)) {
                (crateAmount, crateBDV) = LibUnripeSilo.unripeLPDeposit(account, season);
                LibUnripeSilo.removeLegacyUnripeLPDeposit(account, season);
            }
            require(crateAmount >= amount, "Silo: Crate balance too low.");
        }

        // Partial Withdraw
        if (amount < crateAmount) {
            uint256 removedBDV = amount.mul(crateBDV).div(crateAmount);
            uint256 updatedBDV = crateBDV.sub(removedBDV);
            uint256 updatedAmount = crateAmount.sub(amount);
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

        // Full Remove
        delete s.a[account].legacyDeposits[token][season];
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
        uint32 lastUpdate = s.a[account].lastUpdate;

        if (lastUpdate > stemStartSeason) return 0; 
        return
            stalkReward(
                s.a[account].s.seeds,
                stemStartSeason.sub(lastUpdate)
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
        stem = (int96(season).sub(int96(s.season.stemStartSeason))).mul(int96(seedsPerBdv));
    }

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
        //The balanceOfSeeds(account) > 0 check is necessary if someone updates their Silo
        //in the same Season as BIP execution. Such that s.a[account].lastUpdate == s.season.stemStartSeason,
        //but they have not migrated yet
        require((LibSilo.migrationNeeded(account) || balanceOfSeeds(account) > 0), "no migration needed");


        //do a legacy mow using the old silo seasons deposits
        LibSilo.mintStalk(account, balanceOfGrownStalkUpToStemsDeployment(account)); //should only mint stalk up to stemStartSeason
        updateLastUpdateToNow(account);
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
                perDepositData.amount = amounts[i][j].toUint128();
 
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
                    crateBDV.mul(getSeedsPerToken(address(perTokenData.token))),
                    perDepositData.season
                );
 
                // also need to calculate how much stalk has grown since the migration
                uint128 stalkGrownSinceStemStartSeason = LibSilo.stalkReward(0, perTokenData.stemTip, crateBDV.toUint128()).toUint128();
                perDepositData.grownStalk = perDepositData.grownStalk.add(stalkGrownSinceStemStartSeason);
                migrateData.totalGrownStalk = migrateData.totalGrownStalk.add(stalkGrownSinceStemStartSeason);
 
                // add to new silo
                LibTokenSilo.addDepositToAccount(
                    account, 
                    perTokenData.token, 
                    LibTokenSilo.grownStalkAndBdvToStem(
                        perTokenData.token, 
                        perDepositData.grownStalk,
                        crateBDV
                    ), 
                    perDepositData.amount, 
                    crateBDV,
                    LibTokenSilo.Transfer.emitTransferSingle
                );

                // Include Deposit in the total Deposited BDV.
                LibTokenSilo.incrementTotalDepositedBdv(perTokenData.token, crateBDV);
                incrementMigratedBdv(perTokenData.token, crateBDV);
 
                // add to running total of seeds
                migrateData.totalSeeds = migrateData.totalSeeds.add(crateBDV.mul(getSeedsPerToken(address(perTokenData.token))).toUint128());

                // emit legacy RemoveDeposit event
                emit RemoveDeposit(account, perTokenData.token, perDepositData.season, perDepositData.amount);
            }
 
            // init mow status for this token
            setMowStatus(account, perTokenData.token, perTokenData.stemTip);
        }
 
        // user deserves stalk grown between stemStartSeason and now
        LibSilo.mintStalk(account, migrateData.totalGrownStalk);

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
            //verify merkle tree to determine stalk/seeds diff drift from convert issue
            bytes32 leaf = keccak256(abi.encode(account, stalkDiff, seedsDiff));
            
            require(
                MerkleProof.verify(proof, DISCREPANCY_MERKLE_ROOT, leaf),
                "UnripeClaim: invalid proof"
            );
        }

        //make sure seedsVariance equals seedsDiff input
        require(seedsVariance == seedsDiff, "seeds misalignment, double check submitted deposits");

        AppStorage storage s = LibAppStorage.diamondStorage();

        //emit that all their seeds are gone, note need to take into account seedsDiff
        emit SeedsBalanceChanged(account, -int256(s.a[account].s.seeds));

        //and wipe out old seed balances (all your seeds are belong to stem)
        setBalanceOfSeeds(account, 0);

        //stalk diff was calculated based on ENROOT_FIX_SEASON, so we need to calculate
        //the amount of stalk that has grown since then
        if (seedsDiff > 0) {
            uint256 currentStalkDiff = (uint256(s.season.current).sub(ENROOT_FIX_SEASON)).mul(seedsDiff).add(stalkDiff);

            //emit the stalk variance
            if (currentStalkDiff > 0) {
                LibSilo.burnStalk(account, currentStalkDiff);
            }
        }
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
        if (token == C.BEAN) {
            return 2;
        } else if (token == C.UNRIPE_BEAN) {
            return 2;
        } else if (token == C.UNRIPE_LP) {
            return 4;
        } else if (token == C.CURVE_BEAN_METAPOOL) {
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

    /**
     * @dev Increments the Migrated BDV counter for a given `token` by `bdv`.
     * The `depositedBdv` variable in `Storage.AssetSilo` does not include unmigrated BDV and thus is not accurrate.
     * In a potential future update, it will be necessary for `depositedBdv` to include unmigrated BDV.
     * By summating the `migratedBdv` counter, we can properly account for unmigrated BDV through
     * a 2 step asynchronous upgrade process where adding this counter is the first step.
     */
    function incrementMigratedBdv(address token, uint256 bdv) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.migratedBdvs[token] = s.migratedBdvs[token].add(bdv);
    }
}
