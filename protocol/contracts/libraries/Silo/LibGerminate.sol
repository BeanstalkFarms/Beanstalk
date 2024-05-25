// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, Storage, AppStorage, Account} from "../LibAppStorage.sol";
import {LibSafeMath128} from "../LibSafeMath128.sol";
import {LibSafeMath32} from "../LibSafeMath32.sol";
import {LibSafeMathSigned96} from "../LibSafeMathSigned96.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibSilo} from "./LibSilo.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {C} from "../../C.sol";

/**
 * @title LibGerminate
 * @author Brean
 * @notice LibGerminate handles logic associated with germination.
 * @dev "germinating" values are values that are currently inactive.
 * germinating values stay germinating until the 1 + the remainder of the current season as passed,
 * in which case they become active.
 *
 * The following are germinating:
 * - newly issued stalk (from new deposits or mowing)
 * - roots from newly issued stalk
 * - new bdv introduced in the silo.
 */
library LibGerminate {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;
    using LibSafeMath128 for uint128;
    using LibSafeMathSigned96 for int96;

    //////////////////////// EVENTS ////////////////////////

    /**
     * @notice emitted when the farmers germinating stalk changes.
     */
    event FarmerGerminatingStalkBalanceChanged(
        address indexed account,
        int256 deltaGerminatingStalk,
        Germinate germinationState
    );

    /**
     * @notice emitted when the total germinating amount/bdv changes.
     * @param germinationSeason the season the germination occured.
     * Does not always equal the current season.
     * @param token the token being updated.
     * @param deltaAmount the change in the total germinating amount.
     * @param deltaBdv the change in the total germinating bdv.
     */
    event TotalGerminatingBalanceChanged(
        uint256 germinationSeason,
        address indexed token,
        int256 deltaAmount,
        int256 deltaBdv
    );

    /**
     * @notice emitted when the total germinating stalk changes.
     * @param germinationSeason issuance season of germinating stalk
     * @param deltaGerminatingStalk the change in the total germinating stalk.
     * @dev the issuance season may differ from the season that this event was emitted in..
     */
    event TotalGerminatingStalkChanged(uint256 germinationSeason, int256 deltaGerminatingStalk);

    /**
     * @notice emitted at the sunrise function when the total stalk and roots are incremented.
     * @dev currently, stalk and roots can only increase at the end of `endTotalGermination`,
     * but is casted in the event to allow for future decreases.
     */
    event TotalStalkChangedFromGermination(int256 deltaStalk, int256 deltaRoots);

    struct GermStem {
        int96 germinatingStem;
        int96 stemTip;
    }
    /**
     * @notice Germinate determines what germination struct to use.
     * @dev "odd" and "even" refers to the value of the season counter.
     * "Odd" germinations are used when the season is odd, and vice versa.
     */
    enum Germinate {
        ODD,
        EVEN,
        NOT_GERMINATING
    }

    /**
     * @notice Ends the germination process of system-wide values.
     * @dev we calculate the unclaimed germinating roots of 2 seasons ago
     * as the roots of the stalk should be calculated based on the total stalk
     * when germination finishes, rather than when germination starts.
     */
    function endTotalGermination(uint32 season, address[] memory tokens) external {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // germination can only occur after season 3.
        if (season < 2) return;
        uint32 germinationSeason = season.sub(2);

        // base roots are used if there are no roots in the silo.
        // root calculation is skipped if no deposits have been made
        // in the season.
        uint128 finishedGerminatingStalk = s.unclaimedGerminating[germinationSeason].stalk;
        uint128 rootsFromGerminatingStalk;
        if (s.s.roots == 0) {
            rootsFromGerminatingStalk = finishedGerminatingStalk.mul(uint128(C.getRootsBase()));
        } else if (s.unclaimedGerminating[germinationSeason].stalk > 0) {
            rootsFromGerminatingStalk = s.s.roots.mul(finishedGerminatingStalk).div(s.s.stalk).toUint128();
        }
        s.unclaimedGerminating[germinationSeason].roots = rootsFromGerminatingStalk;
        // increment total stalk and roots based on unclaimed values.
        s.s.stalk = s.s.stalk.add(finishedGerminatingStalk);
        s.s.roots = s.s.roots.add(rootsFromGerminatingStalk);

        // increment total deposited and amounts for each token.
        Storage.TotalGerminating storage totalGerm;
        if (getSeasonGerminationState() == Germinate.ODD) {
            totalGerm = s.oddGerminating;
        } else {
            totalGerm = s.evenGerminating;
        }
        for (uint i; i < tokens.length; ++i) {
            // if the token has no deposits, skip.
            if (totalGerm.deposited[tokens[i]].amount == 0) {
                continue;
            }

            LibTokenSilo.incrementTotalDeposited(
                tokens[i],
                totalGerm.deposited[tokens[i]].amount,
                totalGerm.deposited[tokens[i]].bdv
            );

            // emit events.
            emit TotalGerminatingBalanceChanged(
                germinationSeason,
                tokens[i],
                -int256(totalGerm.deposited[tokens[i]].amount),
                -int256(totalGerm.deposited[tokens[i]].bdv)
            );
            // clear deposited values.
            delete totalGerm.deposited[tokens[i]];
        }

        // emit change in total germinating stalk.
        // safecast not needed as finishedGerminatingStalk is initially a uint128.
        emit TotalGerminatingStalkChanged(germinationSeason, -int256(finishedGerminatingStalk));
        emit TotalStalkChangedFromGermination(int256(finishedGerminatingStalk), int256(rootsFromGerminatingStalk));
    }

    /**
     * @notice contains logic for ending germination for stalk and roots.
     * @param account address of the account to end germination for.
     * @param lastMowedSeason the last season the account mowed.
     *
     * @dev `first` refers to the set of germinating stalk
     * and roots created in the season closest to the current season.
     * i.e if a user deposited in season 10 and 11, the `first` stalk
     * would be season 11.
     *
     * the germination process:
     * - increments the assoicated values (bdv, stalk, roots)
     * - clears the germination struct for the account.
     */
    function endAccountGermination(
        address account,
        uint32 lastMowedSeason,
        uint32 currentSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        bool lastUpdateOdd = isSeasonOdd(lastMowedSeason);
        (uint128 firstStalk, uint128 secondStalk) = getGerminatingStalk(account, lastUpdateOdd);
        uint128 totalRootsFromGermination;
        uint128 germinatingStalk;

        // check to end germination for first stalk.
        // if last mowed season is greater or equal than (currentSeason - 1),
        // then the first stalk is still germinating.
        if (firstStalk > 0 && lastMowedSeason < currentSeason.sub(1)) {
            (uint128 roots, Germinate germState) = claimGerminatingRoots(
                account,
                lastMowedSeason,
                firstStalk,
                lastUpdateOdd
            );
            germinatingStalk = firstStalk;
            totalRootsFromGermination = roots;
            emit FarmerGerminatingStalkBalanceChanged(
                account,
                -int256(germinatingStalk),
                germState
            );
        }

        // check to end germination for second stalk.
        if (secondStalk > 0) {
            (uint128 roots, Germinate germState) = claimGerminatingRoots(
                account,
                lastMowedSeason.sub(1),
                secondStalk,
                !lastUpdateOdd
            );
            germinatingStalk = germinatingStalk.add(secondStalk);
            totalRootsFromGermination = totalRootsFromGermination.add(roots);
            emit FarmerGerminatingStalkBalanceChanged(account, -int256(germinatingStalk), germState);
        }

        // increment users stalk and roots.
        if (germinatingStalk > 0) {
            s.a[account].s.stalk = s.a[account].s.stalk.add(germinatingStalk);
            s.a[account].roots = s.a[account].roots.add(totalRootsFromGermination);

            // emit event. Active stalk is incremented, germinating stalk is decremented.
            emit LibSilo.StalkBalanceChanged(
                account,
                int256(germinatingStalk),
                int256(totalRootsFromGermination)
            );
        }
    }

    /**
     * @notice Claims the germinating roots of an account,
     * as well as clears the germinating stalk and roots.
     *
     * @param account address of the account to end germination for.
     * @param season the season to calculate the germinating roots for.
     * @param stalk the stalk to calculate the germinating roots for.
     * @param clearOdd whether to clear the odd or even germinating stalk.
     */
    function claimGerminatingRoots(
        address account,
        uint32 season,
        uint128 stalk,
        bool clearOdd
    ) private returns (uint128 roots, Germinate germState) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        roots = calculateGerminatingRoots(season, stalk);

        if (clearOdd) {
            delete s.a[account].farmerGerminating.odd;
            germState = Germinate.ODD;
        } else {
            delete s.a[account].farmerGerminating.even;
            germState = Germinate.EVEN;
        }

        // deduct from unclaimed values.
        s.unclaimedGerminating[season].stalk = s.unclaimedGerminating[season].stalk.sub(stalk);
        s.unclaimedGerminating[season].roots = s.unclaimedGerminating[season].roots.sub(roots);
    }

    /**
     * @notice calculates the germinating roots for a given stalk and season.
     * @param season the season to use when calculating the germinating roots.
     * @param stalk the stalk to calculate the germinating roots for.
     */
    function calculateGerminatingRoots(
        uint32 season,
        uint128 stalk
    ) private view returns (uint128 roots) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // if the stalk is equal to the remaining unclaimed germinating stalk,
        // then return the remaining unclaimed germinating roots.
        if (stalk == s.unclaimedGerminating[season].stalk) {
            roots = s.unclaimedGerminating[season].roots;
        } else {
            // calculate the roots. casted up to uint256 to prevent overflow,
            // and safecasted down.
            roots = uint256(stalk).mul(s.unclaimedGerminating[season].roots).div(
                s.unclaimedGerminating[season].stalk
            ).toUint128();
        }
    }

    /**
     * @notice returns the germinatingStalk of the account,
     * ordered based on the parity of lastUpdate.
     * @dev if lastUpdate is odd, then `firstStalk` is the odd stalk.
     */
    function getGerminatingStalk(
        address account,
        bool lastUpdateOdd
    ) internal view returns (uint128 firstStalk, uint128 secondStalk) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (lastUpdateOdd) {
            firstStalk = s.a[account].farmerGerminating.odd;
            secondStalk = s.a[account].farmerGerminating.even;
        } else {
            firstStalk = s.a[account].farmerGerminating.even;
            secondStalk = s.a[account].farmerGerminating.odd;
        }
    }

    /**
     * @notice returns the germinating stalk and roots that will finish germinating
     * upon an interaction with the silo.
     */
    function getFinishedGerminatingStalkAndRoots(
        address account,
        uint32 lastMowedSeason,
        uint32 currentSeason
    ) internal view returns (uint256 germinatingStalk, uint256 germinatingRoots) {
        // if user has mowed already,
        // then there are no germinating stalk and roots to finish.
        if (lastMowedSeason == currentSeason) {
            return (0, 0);
        }

        (uint128 firstStalk, uint128 secondStalk) = getGerminatingStalk(
            account,
            isSeasonOdd(lastMowedSeason)
        );

        // check to end germination for first stalk.
        // if last mowed season is the greater or equal than (currentSeason - 1),
        // then the first stalk is still germinating.
        if (firstStalk > 0 && lastMowedSeason < currentSeason.sub(1)) {
            germinatingStalk = firstStalk;
            germinatingRoots = calculateGerminatingRoots(lastMowedSeason, firstStalk);
        }

        // check to end germination for second stalk.
        if (secondStalk > 0) {
            germinatingStalk = germinatingStalk.add(secondStalk);
            germinatingRoots = germinatingRoots.add(
                calculateGerminatingRoots(lastMowedSeason.sub(1), secondStalk)
            );
        }
    }

    /**
     * @notice returns the stalk currently germinating for an account.
     * Does not include germinating stalk that will finish germinating
     * upon an interaction with the silo.
     */
    function getCurrentGerminatingStalk(
        address account,
        uint32 lastMowedSeason
    ) internal view returns (uint256 germinatingStalk) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // if the last mowed season is less than the current season - 1,
        // then there are no germinating stalk and roots (as all germinating assets have finished).
        if (lastMowedSeason < s.season.current.sub(1)) {
            return 0;
        } else {
            (uint128 firstStalk, uint128 secondStalk) = getGerminatingStalk(
                account,
                isSeasonOdd(lastMowedSeason)
            );
            germinatingStalk = firstStalk.add(secondStalk);
        }
    }

    /**
     * @notice returns the unclaimed germinating stalk and roots.
     */
    function getUnclaimedGerminatingStalkAndRoots(
        uint32 season
    ) internal view returns (Storage.Sr memory unclaimed) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unclaimed = s.unclaimedGerminating[season];
    }

    /**
     * @notice returns the total germinating bdv and amount for a token.
     */
    function getTotalGerminatingForToken(
        address token
    ) internal view returns (uint256 bdv, uint256 amount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (
            s.oddGerminating.deposited[token].bdv.add(s.evenGerminating.deposited[token].bdv),
            s.oddGerminating.deposited[token].amount.add(s.evenGerminating.deposited[token].amount)
        );
    }

    /**
     * @notice determines whether a deposit (token + stem) should be germinating or not.
     * If germinating, determines whether the deposit should be set to even or odd.
     *
     * @dev `getGerminationState` should be used if the stemTip and germinatingStem
     * have not been calculated yet. Otherwise, use `_getGerminationState` for gas effiecnecy.
     */
    function getGerminationState(
        address token,
        int96 stem
    ) internal view returns (Germinate, int96) {
        GermStem memory germStem = getGerminatingStem(token);
        return (_getGerminationState(stem, germStem), germStem.stemTip);
    }

    /**
     * @notice returns the `germinating` stem of a token.
     * @dev the 'germinating' stem is the stem where deposits that have a stem
     * equal or higher than this value are germinating.
     */
    function getGerminatingStem(address token) internal view returns (GermStem memory germStem) {
        germStem.stemTip = LibTokenSilo.stemTipForToken(token);
        germStem.germinatingStem = _getGerminatingStem(token, germStem.stemTip);
    }

    /**
     * @notice returns the `germinating` stem of a token.
     * @dev the 'germinating' stem is the stem where deposits that have a stem
     * equal or higher than this value are germinating.
     */
    function _getGerminatingStem(address token, int96 stemTip) internal view returns (int96 stem) {
        return __getGerminatingStem(stemTip, getPrevStalkEarnedPerSeason(token));
    }

    /**
     * @notice Gas efficent version of `_getGerminatingStem`.
     *
     * @dev use when the stemTip and germinatingStem have already been calculated.
     * Assumes the same token is used.
     * prevStalkEarnedPerSeason is the stalkEarnedPerSeason of the previous season.
     * since `lastStemTip` + `prevStalkEarnedPerSeason` is the current stemTip, 
     * safeMath is not needed.
     */
    function __getGerminatingStem(
        int96 stemTip,
        int96 prevStalkEarnedPerSeason
    ) internal pure returns (int96 stem) {
        return stemTip - prevStalkEarnedPerSeason;
    }

    /**
     * @notice returns the stalkEarnedPerSeason of a token of the previous season.
     * @dev if the milestone season is not the current season, then the stalkEarnedPerSeason
     * hasn't changed from the previous season. Otherwise, we calculate the prevStalkEarnedPerSeason.
     */
    function getPrevStalkEarnedPerSeason(
        address token
    ) private view returns (uint32 prevStalkEarnedPerSeason) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (s.ss[token].milestoneSeason < s.season.current) {
            prevStalkEarnedPerSeason = s.ss[token].stalkEarnedPerSeason;
        } else {
            int24 deltaStalkEarnedPerSeason = s.ss[token].deltaStalkEarnedPerSeason;
            if (deltaStalkEarnedPerSeason >= 0) {
                prevStalkEarnedPerSeason =
                    s.ss[token].stalkEarnedPerSeason -
                    uint32(deltaStalkEarnedPerSeason);
            } else {
                prevStalkEarnedPerSeason =
                    s.ss[token].stalkEarnedPerSeason +
                    uint32(-deltaStalkEarnedPerSeason);
            }
        }
    }

    /**
     * @notice internal function for germination stem.
     * @dev a deposit is germinating if the stem is the stemTip or the germinationStem.
     * the 'germinationStem` is the stem of the token of the previous season.
     *
     * The function must check whether the stem is equal to the germinationStem,
     * to determine which germination state it is in.
     */
    function _getGerminationState(
        int96 stem,
        GermStem memory germData
    ) internal view returns (Germinate) {
        if (stem < germData.germinatingStem) {
            // if the stem of the deposit is lower than the germination stem,
            // then the deposit is not germinating.
            return Germinate.NOT_GERMINATING;
        } else {
            // return the gemination state based on whether the stem
            // is equal to the stemTip.
            // if the stem is equal to the stem tip, it is in the initial stages of germination.
            // if the stem is not equal to the stemTip, its in the germination process.
            if (stem == germData.stemTip) {
                return isCurrentSeasonOdd() ? Germinate.ODD : Germinate.EVEN;
            } else {
                return isCurrentSeasonOdd() ? Germinate.EVEN : Germinate.ODD;
            }
        }
    }

    /**
     * @notice returns the germination state for the current season.
     * @dev used in new deposits, as all new deposits are germinating.
     */
    function getSeasonGerminationState() internal view returns (Germinate) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return getGerminationStateForSeason(s.season.current);
    }

    /**
     * @notice returns the germination state for a given season.
     */
    function getGerminationStateForSeason(uint32 season) internal pure returns (Germinate) {
        return isSeasonOdd(season) ? Germinate.ODD : Germinate.EVEN;
    }

    /**
     * @notice returns whether the current season is odd. Used for Germination.
     * @dev even % 2 = 0 (false), odd % 2 = 1 (true)
     */
    function isCurrentSeasonOdd() internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return isSeasonOdd(s.season.current);
    }

    /**
     * @notice returns whether `season` is odd.
     */
    function isSeasonOdd(uint32 season) internal pure returns (bool) {
        return season.mod(2) == 0 ? false : true;
    }

}
