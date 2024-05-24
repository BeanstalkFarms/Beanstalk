// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Deposited, GerminatingSilo, GerminationSide} from "contracts/beanstalk/storage/System.sol";
import {LibRedundantMath128} from "../LibRedundantMath128.sol";
import {LibRedundantMath32} from "../LibRedundantMath32.sol";
import {LibRedundantMathSigned96} from "../LibRedundantMathSigned96.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibSilo} from "./LibSilo.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
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
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;
    using LibRedundantMath32 for uint32;
    using LibRedundantMath128 for uint128;
    using LibRedundantMathSigned96 for int96;

    //////////////////////// EVENTS ////////////////////////

    /**
     * @notice emitted when the farmers germinating stalk changes.
     */
    event FarmerGerminatingStalkBalanceChanged(address indexed account, int256 delta);

    /**
     * @notice emitted when the total germinating amount/bdv changes.
     */
    event TotalGerminatingBalanceChanged(
        uint256 season,
        address indexed token,
        int256 delta,
        int256 deltaBdv
    );

    struct GermStem {
        int96 germinatingStem;
        int96 stemTip;
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

        // base roots are used if there are no roots in the silo.
        // root calculation is skipped if no deposits have been made
        // in the season.
        if (s.system.silo.roots == 0) {
            // casted to uint256 and downcasted to uint128 to prevent overflow.
            s.system.silo.unclaimedGerminating[season.sub(2)].roots = s
                .system
                .silo
                .unclaimedGerminating[season.sub(2)]
                .stalk
                .mul(uint128(C.getRootsBase()));
        } else if (s.system.silo.unclaimedGerminating[season.sub(2)].stalk > 0) {
            s.system.silo.unclaimedGerminating[season.sub(2)].roots = s
                .system
                .silo
                .roots
                .mul(s.system.silo.unclaimedGerminating[season.sub(2)].stalk)
                .div(s.system.silo.stalk)
                .toUint128();
        }
        // increment total stalk and roots based on unclaimed values.
        s.system.silo.stalk = s.system.silo.stalk.add(
            s.system.silo.unclaimedGerminating[season.sub(2)].stalk
        );
        s.system.silo.roots = s.system.silo.roots.add(
            s.system.silo.unclaimedGerminating[season.sub(2)].roots
        );

        // increment total deposited and amounts for each token.
        GerminationSide side = getSeasonGerminationSide();
        for (uint i; i < tokens.length; ++i) {
            // if the token has no deposits, skip.
            if (s.system.silo.germinating[side][tokens[i]].amount == 0) {
                continue;
            }

            LibTokenSilo.incrementTotalDeposited(
                tokens[i],
                s.system.silo.germinating[side][tokens[i]].amount,
                s.system.silo.germinating[side][tokens[i]].bdv
            );

            // emit events.
            emit TotalGerminatingBalanceChanged(
                season,
                tokens[i],
                -int256(uint256(s.system.silo.germinating[side][tokens[i]].amount)),
                -int256(uint256(s.system.silo.germinating[side][tokens[i]].bdv))
            );

            // clear deposited values.
            delete s.system.silo.germinating[side][tokens[i]];
        }
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
        uint128 roots;
        uint128 germinatingStalk;

        // check to end germination for first stalk.
        // if last mowed season is not equal to current season - 1,
        if (firstStalk > 0 && lastMowedSeason != currentSeason.sub(1)) {
            germinatingStalk = firstStalk;
            roots = claimGerminatingRoots(account, lastMowedSeason, firstStalk, lastUpdateOdd);
        }

        // check to end germination for second stalk.
        if (secondStalk > 0) {
            germinatingStalk = germinatingStalk.add(secondStalk);
            roots = roots.add(
                claimGerminatingRoots(account, lastMowedSeason.sub(1), secondStalk, !lastUpdateOdd)
            );
        }

        // increment users stalk and roots.
        if (germinatingStalk > 0) {
            s.accounts[account].silo.stalk = s.accounts[account].silo.stalk.add(germinatingStalk);
            s.accounts[account].roots = s.accounts[account].roots.add(roots);

            // emit events. Active stalk is incremented, germinating stalk is decremented.
            emit LibSilo.StalkBalanceChanged(
                account,
                int256(uint256(germinatingStalk)),
                int256(uint256(roots))
            );
            emit FarmerGerminatingStalkBalanceChanged(account, -int256(uint256(germinatingStalk)));
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
    ) private returns (uint128 roots) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        roots = calculateGerminatingRoots(season, stalk);

        if (clearOdd) {
            delete s.accounts[account].germinatingStalk[GerminationSide.ODD];
        } else {
            delete s.accounts[account].germinatingStalk[GerminationSide.EVEN];
        }

        // deduct from unclaimed values.
        s.system.silo.unclaimedGerminating[season].stalk = s
            .system
            .silo
            .unclaimedGerminating[season]
            .stalk
            .sub(stalk);
        s.system.silo.unclaimedGerminating[season].roots = s
            .system
            .silo
            .unclaimedGerminating[season]
            .roots
            .sub(roots);
    }

    /**
     * @notice calculates the germinating roots for a given stalk and season.
     * @param season the season to use when calculating the germinating roots.
     * @param stalk the stalk to calculate the germinating roots for.
     */
    function calculateGerminatingRoots(
        uint32 season,
        uint256 stalk
    ) private view returns (uint128 roots) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // if the stalk is equal to the remaining unclaimed germinating stalk,
        // then return the remaining unclaimed germinating roots.
        if (stalk == s.system.silo.unclaimedGerminating[season].stalk) {
            roots = s.system.silo.unclaimedGerminating[season].roots;
        } else {
            // calculate the roots:
            roots = stalk
                .mul(s.system.silo.unclaimedGerminating[season].roots)
                .div(s.system.silo.unclaimedGerminating[season].stalk)
                .toUint128();
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
            firstStalk = s.accounts[account].germinatingStalk[GerminationSide.ODD];
            secondStalk = s.accounts[account].germinatingStalk[GerminationSide.EVEN];
        } else {
            firstStalk = s.accounts[account].germinatingStalk[GerminationSide.EVEN];
            secondStalk = s.accounts[account].germinatingStalk[GerminationSide.ODD];
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
        if (lastMowedSeason < s.system.season.current.sub(1)) {
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
    ) internal view returns (GerminatingSilo memory unclaimed) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unclaimed = s.system.silo.unclaimedGerminating[season];
    }

    /**
     * @notice returns the total germinating bdv and amount for a token.
     */
    function getTotalGerminatingForToken(
        address token
    ) internal view returns (uint256 bdv, uint256 amount) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return (
            s.system.silo.germinating[GerminationSide.ODD][token].bdv +
                s.system.silo.germinating[GerminationSide.EVEN][token].bdv,
            s.system.silo.germinating[GerminationSide.ODD][token].amount +
                s.system.silo.germinating[GerminationSide.EVEN][token].amount
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
    ) internal view returns (GerminationSide, int96) {
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
        return __getGerminatingStem(stemTip, int96(uint96(getPrevStalkEarnedPerSeason(token))));
    }

    /**
     * @notice Gas efficent version of `_getGerminatingStem`.
     *
     * @dev use when the stemTip and germinatingStem have already been calculated.
     * Assumes the same token is used.
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

        if (s.system.silo.assetSettings[token].milestoneSeason < s.system.season.current) {
            prevStalkEarnedPerSeason = s.system.silo.assetSettings[token].stalkEarnedPerSeason;
        } else {
            int24 deltaStalkEarnedPerSeason = s
                .system
                .silo
                .assetSettings[token]
                .deltaStalkEarnedPerSeason;
            if (deltaStalkEarnedPerSeason >= 0) {
                prevStalkEarnedPerSeason =
                    s.system.silo.assetSettings[token].stalkEarnedPerSeason -
                    uint32(int32(deltaStalkEarnedPerSeason));
            } else {
                prevStalkEarnedPerSeason =
                    s.system.silo.assetSettings[token].stalkEarnedPerSeason +
                    uint32(int32(-deltaStalkEarnedPerSeason));
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
    ) internal view returns (GerminationSide) {
        if (stem < germData.germinatingStem) {
            // if the stem of the deposit is lower than the germination stem,
            // then the deposit is not germinating.
            return GerminationSide.NOT_GERMINATING;
        } else {
            // return the gemination state based on whether the stem
            // is equal to the stemTip.
            // if the stem is equal to the stem tip, it is in the inital stages of germination.
            // if the stem is not equal to the stemTip, its in the germination process.
            if (stem == germData.stemTip) {
                return isCurrentSeasonOdd() ? GerminationSide.ODD : GerminationSide.EVEN;
            } else {
                return isCurrentSeasonOdd() ? GerminationSide.EVEN : GerminationSide.ODD;
            }
        }
    }

    /**
     * @notice returns the germination side for the current season.
     * @dev used in new deposits, as all new deposits are germinating.
     */
    function getSeasonGerminationSide() internal view returns (GerminationSide) {
        return isCurrentSeasonOdd() ? GerminationSide.ODD : GerminationSide.EVEN;
    }

    /**
     * @notice returns whether the current season is odd. Used for Germination.
     * @dev even % 2 = 0 (false), odd % 2 = 1 (true)
     */
    function isCurrentSeasonOdd() internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return isSeasonOdd(s.system.season.current);
    }

    /**
     * @notice returns whether `season` is odd.
     */
    function isSeasonOdd(uint32 season) internal pure returns (bool) {
        return season.mod(2) == 0 ? false : true;
    }
}
