/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;
pragma abicoder v2;

import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {GerminationSide} from "contracts/beanstalk/storage/System.sol";
import {C} from "../../C.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibBytes} from "../LibBytes.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibRedundantMath128} from "../LibRedundantMath128.sol";
import {LibRedundantMath32} from "../LibRedundantMath32.sol";
import {LibRedundantMathSigned96} from "../LibRedundantMathSigned96.sol";
import {LibGerminate} from "./LibGerminate.sol";
import {LibWhitelistedTokens} from "./LibWhitelistedTokens.sol";
import {LibTractor} from "../LibTractor.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import {LibFlood} from "contracts/libraries/Silo/LibFlood.sol";

/**
 * @title LibSilo
 * @author Publius
 * @notice Contains functions for minting, burning, and transferring of
 * Stalk and Roots within the Silo.
 *
 * @dev Here, we refer to "minting" as the combination of
 * increasing the total balance of Stalk/Roots, as well as allocating
 * them to a particular account. However, in other places throughout Beanstalk
 * (like during the Sunrise), Beanstalk's total balance of Stalk increases
 * without allocating to a particular account. One example is {Sun-rewardToSilo}
 * which increases `s.silo.stalk` but does not allocate it to any account. The
 * allocation occurs during `{SiloFacet-plant}`. Does this change how we should
 * call "minting"?
 *
 * In the ERC20 context, "minting" increases the supply of a token and allocates
 * the new tokens to an account in one action. I've adjusted the comments below
 * to use "mint" in the same sense.
 */
library LibSilo {
    using LibRedundantMath256 for uint256;
    using LibRedundantMath128 for uint128;
    using LibRedundantMathSigned96 for int96;
    using LibRedundantMath32 for uint32;
    using SafeCast for uint256;

    //////////////////////// ENUM ////////////////////////

    /**
     * @dev when a user removes multiple deposits, the
     * {TransferBatch} event is emitted. However, in the
     * case of an enroot, the event is omitted (as the
     * depositID does not change). This enum is
     * used to determine if the event should be emitted.
     */
    enum ERC1155Event {
        EMIT_BATCH_EVENT,
        NO_EMIT_BATCH_EVENT
    }

    uint128 internal constant PRECISION = 1e6;
    //////////////////////// EVENTS ////////////////////////

    /**
     * @notice Emitted when `account` gains or loses Stalk.
     * @param account The account that gained or lost Stalk.
     * @param delta The change in Stalk.
     * @param deltaRoots The change in Roots.
     *
     * @dev Should be emitted anytime a Deposit is added, removed or transferred
     * AND anytime an account Mows Grown Stalk.
     *
     * BIP-24 included a one-time re-emission of {StalkBalanceChanged} for
     * accounts that had executed a Deposit transfer between the Replant and
     * BIP-24 execution. For more, see:
     *
     * [BIP-24](https://bean.money/bip-24)
     * [Event-Emission](https://github.com/BeanstalkFarms/BIP-24-Event-Emission)
     */
    event StalkBalanceChanged(address indexed account, int256 delta, int256 deltaRoots);

    /**
     * @notice Emitted when a deposit is removed from the silo.
     *
     * @param account The account assoicated with the removed deposit.
     * @param token The token address of the removed deposit.
     * @param stem The stem of the removed deposit.
     * @param amount The amount of "token" removed from an deposit.
     * @param bdv The instanteous bdv removed from the deposit.
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice Emitted when multiple deposits are removed from the silo.
     *
     * @param account The account assoicated with the removed deposit.
     * @param token The token address of the removed deposit.
     * @param stems A list of stems of the removed deposits.
     * @param amounts A list of amounts removed from the deposits.
     * @param amount the total summation of the amount removed.
     * @param bdvs A list of bdvs removed from the deposits.
     */
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    /**
     * AssetsRemoved contains the assets removed
     * during a withdraw or convert.
     *
     * @dev seperated into 3 catagories:
     * active: non-germinating assets.
     * odd: odd germinating assets.
     * even: even germinating assets.
     * grownStalk from germinating depoists are seperated
     * as that stalk is not germinating.
     */
    struct AssetsRemoved {
        Removed active;
        Removed odd;
        Removed even;
        uint256 grownStalkFromGermDeposits;
    }

    struct Removed {
        uint256 tokens;
        uint256 stalk;
        uint256 bdv;
    }

    /**
     * @notice Equivalent to multiple {TransferSingle} events, where `operator`, `from` and `to` are the same for all
     * transfers.
     */
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );

    //////////////////////// MINT ////////////////////////

    /**
     * @dev Mints Stalk and Roots to `account`.
     *
     * `roots` are an underlying accounting variable that is used to track
     * how many earned beans a user has.
     *
     * When a farmer's state is updated, the ratio should hold:
     *
     *  Total Roots     User Roots
     * ------------- = ------------
     *  Total Stalk     User Stalk
     *
     * @param account the address to mint Stalk and Roots to
     * @param stalk the amount of stalk to mint
     *
     * @dev Stalk that is not germinating are `active`, meaning that they
     * are eligible for bean mints. To mint germinating stalk, use
     * `mintGerminatingStalk`.
     */
    function mintActiveStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots;
        if (s.sys.silo.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else {
            // germinating assets should be considered
            // when calculating roots
            roots = s.sys.silo.roots.mul(stalk).div(s.sys.silo.stalk);
        }

        // increment user and total stalk;
        s.sys.silo.stalk = s.sys.silo.stalk.add(stalk);
        s.accts[account].stalk = s.accts[account].stalk.add(stalk);

        // increment user and total roots
        s.sys.silo.roots = s.sys.silo.roots.add(roots);
        s.accts[account].roots = s.accts[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    /**
     * @notice mintGerminatingStalk contains logic for minting stalk that is germinating.
     * @dev `germinating stalk` are newly issued stalk that are not eligible for bean mints,
     * until 2 `gm` calls have passed, at which point they are considered `grown stalk`.
     *
     * Since germinating stalk are not elgible for bean mints, when calculating the roots of these
     * stalk, it should use the stalk and roots of the system once the stalk is fully germinated,
     * rather than at the time of minting.
     */
    function mintGerminatingStalk(address account, uint128 stalk, GerminationSide side) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.accts[account].germinatingStalk[side] += stalk;

        // germinating stalk are either newly germinating, or partially germinated.
        // Thus they can only be incremented in the latest or previous season.
        uint32 season = s.sys.season.current;
        if (LibGerminate.getSeasonGerminationSide() == side) {
            s.sys.silo.unclaimedGerminating[season].stalk += stalk;
        } else {
            s.sys.silo.unclaimedGerminating[season - 1].stalk += stalk;
        }

        // emit events.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            account,
            int256(uint256(stalk)),
            side
        );
        emit LibGerminate.TotalGerminatingStalkChanged(season, int256(uint256(stalk)));
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @notice Burns stalk and roots from an account.
     */
    function burnActiveStalk(address account, uint256 stalk) internal returns (uint256 roots) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return 0;

        // Calculate the amount of Roots for the given amount of Stalk.
        roots = s.sys.silo.roots.mul(stalk).div(s.sys.silo.stalk);
        if (roots > s.accts[account].roots) roots = s.accts[account].roots;

        // Decrease supply of Stalk; Remove Stalk from the balance of `account`
        s.sys.silo.stalk = s.sys.silo.stalk.sub(stalk);
        s.accts[account].stalk = s.accts[account].stalk.sub(stalk);

        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.sys.silo.roots = s.sys.silo.roots.sub(roots);
        s.accts[account].roots = s.accts[account].roots.sub(roots);

        // emit event.
        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    /**
     * @notice Burns germinating stalk.
     * @dev Germinating stalk does not have any roots assoicated with it.
     */
    function burnGerminatingStalk(address account, uint128 stalk, GerminationSide side) external {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.accts[account].germinatingStalk[side] -= stalk;

        // germinating stalk are either newly germinating, or partially germinated.
        // Thus they can only be decremented in the latest or previous season.
        uint32 season = s.sys.season.current;
        if (LibGerminate.getSeasonGerminationSide() == side) {
            s.sys.silo.unclaimedGerminating[season].stalk -= stalk;
        } else {
            s.sys.silo.unclaimedGerminating[season - 1].stalk -= stalk;
        }

        // emit events.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            account,
            -int256(uint256(stalk)),
            side
        );
        emit LibGerminate.TotalGerminatingStalkChanged(season, -int256(uint256(stalk)));
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @notice Decrements the Stalk and Roots of `sender` and increments the Stalk
     * and Roots of `recipient` by the same amount.
     *
     */
    function transferStalk(address sender, address recipient, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 roots;
        roots = stalk == s.accts[sender].stalk
            ? s.accts[sender].roots
            : s.sys.silo.roots.sub(1).mul(stalk).div(s.sys.silo.stalk).add(1);

        // Subtract Stalk and Roots from the 'sender' balance.
        s.accts[sender].stalk = s.accts[sender].stalk.sub(stalk);
        s.accts[sender].roots = s.accts[sender].roots.sub(roots);
        emit StalkBalanceChanged(sender, -int256(stalk), -int256(roots));

        // Add Stalk and Roots to the 'recipient' balance.
        s.accts[recipient].stalk = s.accts[recipient].stalk.add(stalk);
        s.accts[recipient].roots = s.accts[recipient].roots.add(roots);
        emit StalkBalanceChanged(recipient, int256(stalk), int256(roots));
    }

    /**
     * @notice germinating counterpart of `transferStalk`.
     * @dev assumes stalk is germinating.
     */
    function transferGerminatingStalk(
        address sender,
        address recipient,
        uint256 stalk,
        GerminationSide side
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // Subtract Germinating Stalk from the 'sender' balance,
        // and Add to the 'recipient' balance.
        s.accts[sender].germinatingStalk[side] -= stalk.toUint128();
        s.accts[recipient].germinatingStalk[side] += stalk.toUint128();

        // emit events.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            sender,
            -int256(uint256(stalk)),
            side
        );
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            recipient,
            int256(uint256(stalk)),
            side
        );
    }

    /**
     * @notice transfers both stalk and Germinating Stalk.
     * @dev used in {TokenSilo._transferDeposits}
     */
    function transferStalkAndGerminatingStalk(
        address sender,
        address recipient,
        address token,
        AssetsRemoved memory ar
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 stalkPerBDV = s.sys.silo.assetSettings[token].stalkIssuedPerBdv;

        if (ar.odd.bdv > 0) {
            uint256 initialStalk = ar.odd.bdv.mul(stalkPerBDV);
            if (token == C.BEAN) {
                // check whether the Germinating Stalk transferred exceeds the farmers
                // Germinating Stalk. If so, the difference is considered from Earned
                // Beans. Deduct the odd BDV and increment the activeBDV by the difference.
                (uint256 senderGerminatingStalk, uint256 earnedBeansStalk) = checkForEarnedBeans(
                    sender,
                    initialStalk,
                    GerminationSide.ODD
                );
                if (earnedBeansStalk > 0) {
                    // increment the active stalk by the earned beans active stalk.
                    // decrement the germinatingStalk stalk by the earned beans active stalk.
                    ar.active.stalk = ar.active.stalk.add(earnedBeansStalk);
                    initialStalk = senderGerminatingStalk;
                }
            }
            transferGerminatingStalk(sender, recipient, initialStalk, GerminationSide.ODD);
        }

        if (ar.even.bdv > 0) {
            uint256 initialStalk = ar.even.bdv.mul(stalkPerBDV);
            if (token == C.BEAN) {
                // check whether the Germinating Stalk transferred exceeds the farmers
                // Germinating Stalk. If so, the difference is considered from Earned
                // Beans. Deduct the even BDV and increment the active BDV by the difference.
                (uint256 senderGerminatingStalk, uint256 earnedBeansStalk) = checkForEarnedBeans(
                    sender,
                    initialStalk,
                    GerminationSide.EVEN
                );
                if (earnedBeansStalk > 0) {
                    // increment the active stalk by the earned beans active stalk.
                    // decrement the germinatingStalk stalk by the earned beans active stalk.
                    ar.active.stalk = ar.active.stalk.add(earnedBeansStalk);
                    initialStalk = senderGerminatingStalk;
                }
            }

            transferGerminatingStalk(sender, recipient, initialStalk, GerminationSide.EVEN);
        }

        // a Germinating Deposit may have Grown Stalk (which is not Germinating),
        // but the base Stalk is still Germinating.
        // Grown Stalk from non-Germinating Deposits, and base stalk from Earned Bean Deposits.
        // base stalk from non-germinating deposits.
        // grown stalk from Even Germinating Deposits.
        // grown stalk from Odd Germinating Deposits.
        ar.active.stalk = ar
            .active
            .stalk
            .add(ar.active.bdv.mul(stalkPerBDV))
            .add(ar.even.stalk)
            .add(ar.odd.stalk);
        if (ar.active.stalk > 0) {
            transferStalk(sender, recipient, ar.active.stalk);
        }
    }

    /**
     * @dev Claims the Grown Stalk for `account` and applies it to their Stalk
     * balance. Also handles Season of Plenty related rain.
     *
     * This is why `_mow()` must be called before any actions that change Seeds,
     * including:
     *  - {SiloFacet-deposit}
     *  - {SiloFacet-withdrawDeposit}
     *  - {SiloFacet-withdrawDeposits}
     *  - {_plant}
     *  - {SiloFacet-transferDeposit(s)}
     */
    function _mow(address account, address token) external {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // if the user has not migrated from siloV2, revert.
        uint32 lastUpdate = _lastUpdate(account);

        // sop data only needs to be updated once per season,
        // if it started raining and it's still raining, or there was a sop
        uint32 currentSeason = s.sys.season.current;
        if (s.sys.season.rainStart > s.sys.season.stemStartSeason) {
            if (lastUpdate <= s.sys.season.rainStart && lastUpdate <= currentSeason) {
                // Increments `plenty` for `account` if a Flood has occured.
                // Saves Rain Roots for `account` if it is Raining.
                LibFlood.handleRainAndSops(account, lastUpdate);
            }
        }

        // End account germination.
        if (lastUpdate < currentSeason) {
            LibGerminate.endAccountGermination(account, lastUpdate, currentSeason);
        }
        // Calculate the amount of Grown Stalk claimable by `account`.
        // Increase the account's balance of Stalk and Roots.
        __mow(account, token);

        // update lastUpdate for sop and germination calculations.
        s.accts[account].lastUpdate = currentSeason;
    }

    /**
     * @dev Updates the mowStatus for the given account and token,
     * and mints Grown Stalk for the given account and token.
     */
    function __mow(address account, address token) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        int96 _stemTip = LibTokenSilo.stemTipForToken(token);
        int96 _lastStem = s.accts[account].mowStatuses[token].lastStem;
        uint128 _bdv = s.accts[account].mowStatuses[token].bdv;

        // if:
        // 1: account has no bdv (new token deposit)
        // 2: the lastStem is the same as the stemTip (implying that a user has mowed),
        // then skip calculations to save gas.
        if (_bdv > 0) {
            if (_lastStem == _stemTip) {
                return;
            }

            // grown stalk does not germinate and is immediately included for bean mints.
            mintActiveStalk(account, _balanceOfGrownStalk(_lastStem, _stemTip, _bdv));
        }

        // If this `account` has no BDV, skip to save gas. Update lastStem.
        // (happen on initial deposit, since mow is called before any deposit)
        s.accts[account].mowStatuses[token].lastStem = _stemTip;
        return;
    }

    /**
     * @notice returns the last season an account interacted with the silo.
     */
    function _lastUpdate(address account) internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.accts[account].lastUpdate;
    }

    /**
     * @dev returns the balance of amount of grown stalk based on stems.
     * @param lastStem the stem assoicated with the last mow
     * @param latestStem the current stem for a given token
     * @param bdv the bdv used to calculate grown stalk
     */
    function _balanceOfGrownStalk(
        int96 lastStem,
        int96 latestStem,
        uint128 bdv
    ) internal pure returns (uint256) {
        return stalkReward(lastStem, latestStem, bdv);
    }

    //////////////////////// REMOVE ////////////////////////

    /**
     * @dev Removes from a single Deposit, emits the RemoveDeposit event,
     * and returns the Stalk/BDV that were removed.
     *
     * Used in:
     * - {TokenSilo:_withdrawDeposit}
     * - {TokenSilo:_transferDeposit}
     */
    function _removeDepositFromAccount(
        address account,
        address token,
        int96 stem,
        uint256 amount,
        LibTokenSilo.Transfer transferType
    )
        internal
        returns (
            uint256 initialStalkRemoved,
            uint256 grownStalkRemoved,
            uint256 bdvRemoved,
            GerminationSide side
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        int96 stemTip;
        (side, stemTip) = LibGerminate.getGerminationState(token, stem);
        bdvRemoved = LibTokenSilo.removeDepositFromAccount(account, token, stem, amount);

        // the initial and grown stalk are seperated as there are instances
        // where the initial stalk issued for a deposit is germinating. Grown stalk never germinates,
        // and thus is not included in the germinating stalk.
        initialStalkRemoved = bdvRemoved.mul(s.sys.silo.assetSettings[token].stalkIssuedPerBdv);

        grownStalkRemoved = stalkReward(stem, stemTip, bdvRemoved.toUint128());
        /**
         *  {_removeDepositFromAccount} is used for both withdrawing and transferring deposits.
         *  In the case of a withdraw, only the {TransferSingle} Event needs to be emitted.
         *  In the case of a transfer, a different {TransferSingle}/{TransferBatch}
         *  Event is emitted in {TokenSilo._transferDeposit(s)},
         *  and thus, this event is ommited.
         */
        if (transferType == LibTokenSilo.Transfer.emitTransferSingle) {
            // "removing" a deposit is equivalent to "burning" an ERC1155 token.
            emit LibTokenSilo.TransferSingle(
                LibTractor._user(), // operator
                account, // from
                address(0), // to
                LibBytes.packAddressAndStem(token, stem), // depositid
                amount // token amount
            );
        }
        emit RemoveDeposit(account, token, stem, amount, bdvRemoved);
    }

    /**
     * @dev Removes from multiple Deposits, emits the RemoveDeposits
     * event, and returns the Stalk/BDV that were removed.
     *
     * Used in:
     * - {TokenSilo:_withdrawDeposits}
     * - {SiloFacet:enrootDeposits}
     *
     * @notice with the addition of germination, AssetsRemoved
     * keeps track of the germinating data.
     */
    function _removeDepositsFromAccount(
        address account,
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts,
        ERC1155Event emission
    ) internal returns (AssetsRemoved memory ar) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256[] memory bdvsRemoved = new uint256[](stems.length);
        uint256[] memory removedDepositIDs = new uint256[](stems.length);
        LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);
        for (uint256 i; i < stems.length; ++i) {
            GerminationSide side = LibGerminate._getGerminationState(stems[i], germStem);
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                account,
                token,
                stems[i],
                amounts[i]
            );
            bdvsRemoved[i] = crateBdv;
            removedDepositIDs[i] = LibBytes.packAddressAndStem(token, stems[i]);
            uint256 crateStalk = stalkReward(stems[i], germStem.stemTip, crateBdv.toUint128());

            // if the deposit is germinating, decrement germinating values,
            // otherwise increment deposited values.
            if (side == GerminationSide.NOT_GERMINATING) {
                ar.active.bdv = ar.active.bdv.add(crateBdv);
                ar.active.stalk = ar.active.stalk.add(crateStalk);
                ar.active.tokens = ar.active.tokens.add(amounts[i]);
            } else {
                if (side == GerminationSide.ODD) {
                    ar.odd.bdv = ar.odd.bdv.add(crateBdv);
                    ar.odd.tokens = ar.odd.tokens.add(amounts[i]);
                } else {
                    ar.even.bdv = ar.even.bdv.add(crateBdv);
                    ar.even.tokens = ar.even.tokens.add(amounts[i]);
                }
                // grown stalk from germinating deposits do not germinate,
                // and thus must be added to the grown stalk.
                ar.grownStalkFromGermDeposits = ar.grownStalkFromGermDeposits.add(crateStalk);
            }
        }

        // add initial stalk deposit to all stalk removed.
        {
            uint256 stalkIssuedPerBdv = s.sys.silo.assetSettings[token].stalkIssuedPerBdv;
            if (ar.active.tokens > 0) {
                ar.active.stalk = ar.active.stalk.add(ar.active.bdv.mul(stalkIssuedPerBdv));
            }

            if (ar.odd.tokens > 0) {
                ar.odd.stalk = ar.odd.bdv.mul(stalkIssuedPerBdv);
            }

            if (ar.even.tokens > 0) {
                ar.even.stalk = ar.even.bdv.mul(stalkIssuedPerBdv);
            }
        }

        // "removing" deposits is equivalent to "burning" a batch of ERC1155 tokens.
        if (emission == ERC1155Event.EMIT_BATCH_EVENT) {
            emit TransferBatch(msg.sender, account, address(0), removedDepositIDs, amounts);
        }

        emit RemoveDeposits(
            account,
            token,
            stems,
            amounts,
            ar.active.tokens.add(ar.odd.tokens).add(ar.even.tokens),
            bdvsRemoved
        );
    }

    //////////////////////// UTILITIES ////////////////////////

    /**
     * @notice Calculates the Stalk reward based on the start and end
     * stems, and the amount of BDV deposited. Stems represent the
     * amount of grown stalk per BDV, so the difference between the
     * start index and end index (stem) multiplied by the amount of
     * bdv deposited will give the amount of stalk earned.
     * formula: stalk = bdv * (ΔstalkPerBdv)
     *
     * @dev endStem must be larger than startStem.
     *
     */
    function stalkReward(
        int96 startStem,
        int96 endStem,
        uint128 bdv
    ) internal pure returns (uint256) {
        uint128 reward = uint128(uint96(endStem.sub(startStem))).mul(bdv).div(PRECISION);

        return reward;
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
    function _balanceOfEarnedBeans(
        uint256 accountStalk,
        uint256 accountRoots
    ) internal view returns (uint256 beans) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // There will be no Roots before the first Deposit is made.
        if (s.sys.silo.roots == 0) return 0;

        uint256 stalk = s.sys.silo.stalk.mul(accountRoots).div(s.sys.silo.roots);

        // Beanstalk rounds down when minting Roots. Thus, it is possible that
        // balanceOfRoots / totalRoots * totalStalk < s.accts[account].stalk.
        // As `account` Earned Balance balance should never be negative,
        // Beanstalk returns 0 instead.
        if (stalk <= accountStalk) return 0;

        // Calculate Earned Stalk and convert to Earned Beans.
        beans = (stalk - accountStalk).div(C.STALK_PER_BEAN);
        if (beans > s.sys.silo.earnedBeans) return s.sys.silo.earnedBeans;

        return beans;
    }

    /**
     * @notice Returns the amount of Germinating Stalk
     * for a given GerminationSide enum.
     * @dev When a Farmer attempts to withdraw Beans from a Deposit that has a Germinating Stem,
     * `checkForEarnedBeans` is called to determine how many of the Beans were Planted vs Deposited.
     * If a Farmer withdraws a Germinating Deposit with Earned Beans, only subtract the Germinating Beans
     * from the Germinating Balances
     * @return germinatingStalk stalk that is germinating for a given GerminationSide enum.
     * @return earnedBeanStalk the earned bean portion of stalk for a given GerminationSide enum.
     */
    function checkForEarnedBeans(
        address account,
        uint256 stalk,
        GerminationSide side
    ) internal view returns (uint256 germinatingStalk, uint256 earnedBeanStalk) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 farmerGerminatingStalk = s.accts[account].germinatingStalk[side];
        if (stalk > farmerGerminatingStalk) {
            return (farmerGerminatingStalk, stalk.sub(farmerGerminatingStalk));
        } else {
            return (stalk, 0);
        }
    }
}
