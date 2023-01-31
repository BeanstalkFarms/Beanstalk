/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "~/libraries/LibBytes.sol";
import "../LibAppStorage.sol";
import "../../C.sol";
import "./LibUnripeSilo.sol";
import "./LibTokenSilo.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import "~/libraries/LibSafeMathSigned128.sol";
import "hardhat/console.sol";

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
    using SafeMath for uint32;
    using SafeCast for uint256;
    using LibSafeMathSigned128 for int128;

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
     * @dev Locate the `amount` and `bdv` for a user's Deposit in storage.
     *
     * Silo V2 Deposits are stored within each {Account} as a mapping of:
     *  `address token => uint32 season => { uint128 amount, uint128 bdv }`
     *
     * Unripe BEAN and Unripe LP are handled independently so that data
     * stored in the legacy Silo V1 format and the new Silo V2 format can
     * be appropriately merged. See {LibUnripeSilo} for more information.
     *
     * FIXME(naming): rename to `getDeposit()`?
     */
    function tokenDeposit(
        address account,
        address token,
        uint32 season
    ) internal view returns (uint256, uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (LibUnripeSilo.isUnripeBean(token))
            return LibUnripeSilo.unripeBeanDeposit(account, season);

        if (LibUnripeSilo.isUnripeLP(token))
            return LibUnripeSilo.unripeLPDeposit(account, season);

        return (
            s.a[account].legacyDeposits[token][season].amount,
            s.a[account].legacyDeposits[token][season].bdv
        );
    }


    function isDepositSeason(IERC20 token, int128 grownStalkPerBdv)
        internal
        view
        returns (bool)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 seedsPerBdv = uint256(s.ss[address(token)].legacySeedsPerBdv);
        return
            grownStalkPerBdv < 0 &&
            uint256(-grownStalkPerBdv) % seedsPerBdv != 0;
    }

    function grownStalkPerBdvToSeason(IERC20 token, int128 grownStalkPerBdv)
        internal
        view
        returns (uint32 season)
    {
        // require(grownStalkPerBdv > 0);
        console.log('grownStalkPerBdvToSeason logging grown stalk per bdv');
        console.logInt(grownStalkPerBdv);
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 seedsPerBdv = uint256(s.ss[address(token)].legacySeedsPerBdv);

        uint32 lastUpdateSeasonStored = s.ss[address(token)].lastUpdateSeason;
        console.log('grownStalkPerBdvToSeason lastUpdateSeasonStored: ', lastUpdateSeasonStored);

        console.log('grownStalkPerBdvToSeason token: ', address(token));
        // console.log('s.ss[address(token)]: ', s.ss[address(token)]);
        console.log('grownStalkPerBdvToSeason seedsPerBdv: ', seedsPerBdv);
        // console.log('grownStalkPerBdv: %d', grownStalkPerBdv);
        // console.log('uint256(-grownStalkPerBdv).div(seedsPerBdv): ', uint256(-grownStalkPerBdv).div(seedsPerBdv));

        // uint256 seasonAs256 = uint256(int128(s.ss[address(token)].lastCumulativeGrownStalkPerBdv).sub(grownStalkPerBdv)).div(seedsPerBdv);
        // console.log('seasonAs256: ', seasonAs256);

        //need to divide by 1e6 but make sure we don't round
        season = s.season.current.sub(uint(grownStalkPerBdv).div(seedsPerBdv)).toUint32();
        console.log('grownStalkPerBdvToSeason season: ', season);
        // season = seasonAs256.toUint32();
    }
}
