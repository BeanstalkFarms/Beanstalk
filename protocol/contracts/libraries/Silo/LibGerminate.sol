// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, Storage, AppStorage, Account} from "../LibAppStorage.sol";
import {LibWhitelistedTokens} from "./LibWhitelistedTokens.sol";
import {LibSafeMath32} from "../LibSafeMath32.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibBitMask} from "./LibBitMask.sol";
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
    using LibBitMask for bytes4;
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;

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
     * @dev This includes:
     * - total germinating stalk
     * - total germinating roots
     * - total germinating deposited per whitelisted token
     * - total germinating bdv per whitelistedtoken 
     * The germination process should end the germiation 
     * of the same parity of the season.
     */
    function endTotalGermination() internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Germinate seasonGerm = getSeasonGerminationState();
        Storage.TotalGerminating storage totalGerm;
        if (seasonGerm == Germinate.ODD) {
            totalGerm = s.oddGerminating;
        } else {
            totalGerm = s.evenGerminating;
        }

        // increment total stalk and roots.
        s.s.stalk = s.s.stalk.add(totalGerm.stalk);
        s.s.roots = s.s.roots.add(totalGerm.roots);

        // clear germinating stalk and roots.
        delete totalGerm.stalk;
        delete totalGerm.roots;

        // increment total deposited and amounts for each whitelisted token.
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedTokens();
        for (uint i; i < tokens.length; ++i) {
            LibTokenSilo.incrementTotalDeposited(
                tokens[i], 
                totalGerm.deposited[tokens[i]].amount,
                totalGerm.deposited[tokens[i]].bdv
            );
            delete totalGerm.deposited[tokens[i]];
        }

    }
    /**
     * @notice ends the germination process for a given account.
     * @param account address of the account to end germination for.
     * @dev the germination process:
     * - increments the assoicated values (bdv, stalk, roots)
     * - clears the germination struct for the account.
     * 
     * returns seasonGerm for gas effciency.
     */
    function endAccountGermination(address account) internal returns (Germinate seasonGerm) {
        seasonGerm = getSeasonGerminationState();

        // 1) clear out germinating BDV for all masked tokens, and increment bdv for each token.
        endGerminatingBdv(account, seasonGerm);
        // 2) end germination for stalk and roots.
        endGerminatingStalk(account, seasonGerm);
    }

    /**
     * @notice contains the logic with ending germination for bdv.
     * @param account address of the account to end germination for.
     * @param seasonGerm the germination state for the current season.
     * @dev the germination of the current season is cleared as the values 
     * here have been germinating for at least 1 season.
     * This function ends germination for all tokens, even though this is used for only one.
     */
    function endGerminatingBdv(
        address account,
        Germinate seasonGerm
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Account.FarmerGerminating storage farmerGerm;

        // get germination target
        if (seasonGerm == Germinate.ODD) {
            farmerGerm = s.a[account].oddGerminating;
        } else {
            farmerGerm = s.a[account].evenGerminating;
        }

        bytes4 bitMask = farmerGerm.germinatingTokenMask;
        // if the bit is set, increment mowStatuses and delete germinating bdv.
        address[] memory tokens = LibWhitelistedTokens.getWhitelistedTokens();
        for(uint i; i < tokens.length; ++i) {
            if (bitMask.isBitSet(i)) {
                s.a[account].mowStatuses[tokens[i]].bdv += farmerGerm.bdv[tokens[i]].toUint128();
                delete farmerGerm.bdv[tokens[i]];
            }
        }
    }

    /**
     * @notice contains logic for ending germination for stalk and roots.
     * @param account address of the account to end germination for.
     * @param seasonGerm the germination state for the current season.
     */
    function endGerminatingStalk(
        address account,
        Germinate seasonGerm
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Account.FarmerGerminating storage farmerGerm;

        if (seasonGerm == Germinate.ODD) {
            farmerGerm = s.a[account].oddGerminating;
        } else {
            farmerGerm = s.a[account].evenGerminating;
        }
        
        s.a[account].s.stalk += farmerGerm.stalk;
        s.a[account].roots += farmerGerm.roots;

        delete farmerGerm.stalk;
        delete farmerGerm.roots;
    }

    /**
     * @notice determines whether a deposit (token + stem) should be germinating or not.
     * If germinating, determines whether the deposit should be set to even or odd.
     * 
     * @dev `getGerminationState` should be used if the stemTip and germinatingStem 
     * have not been caluculated yet. Otherwise, use `_getGerminationState` for gas effiecnecy.
     */
    function getGerminationState(address token, int96 stem) internal view returns (Germinate, int96) {
        // if the stem of the token is the stemTip, then it should be germinating.
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
        return stemTip - int96(getPrevStalkEarnedPerSeason(token));
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
                    s.ss[token].stalkEarnedPerSeason +
                    uint32(deltaStalkEarnedPerSeason);
            } else {
                prevStalkEarnedPerSeason =
                    s.ss[token].stalkEarnedPerSeason -
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
            // if the stem is equal to the stem tip, it is in the inital stages of germination.
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
        return isCurrentSeasonOdd() ? Germinate.ODD : Germinate.EVEN;
    }

    /**
     * @notice returns whether the current season is odd. Used for Germination.
     * @dev even % 2 = 0 (false), odd % 2 = 1 (true)
     */
    function isCurrentSeasonOdd() internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.season.current.mod(2) == 0 ? false : true;
    }

}
