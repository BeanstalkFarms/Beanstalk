/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma abicoder v2;

import "../LibAppStorage.sol";
import {C} from "../../C.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibBytes} from "../LibBytes.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibSafeMath128} from "../LibSafeMath128.sol";
import {LibSafeMath32} from "../LibSafeMath32.sol";
import {LibSafeMathSigned96} from "../LibSafeMathSigned96.sol";
import {LibGerminate} from "./LibGerminate.sol";
import {LibWhitelistedTokens} from "./LibWhitelistedTokens.sol";

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
 * which increases `s.s.stalk` but does not allocate it to any account. The
 * allocation occurs during `{SiloFacet-plant}`. Does this change how we should
 * call "minting"?
 *
 * In the ERC20 context, "minting" increases the supply of a token and allocates
 * the new tokens to an account in one action. I've adjusted the comments below
 * to use "mint" in the same sense.
 */
library LibSilo {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;
    using LibSafeMathSigned96 for int96;
    using LibSafeMath32 for uint32;
    using SafeCast for uint256;

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
        if (s.s.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else {
            // germinating assets should be considered
            // when calculating roots
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
        }

        // increment user and total stalk;
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // increment user and total roots
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

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
    function mintGerminatingStalk(
        address account,
        uint128 stalk,
        LibGerminate.Germinate germ
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (germ == LibGerminate.Germinate.ODD) {
            s.a[account].farmerGerminating.odd = s.a[account].farmerGerminating.odd.add(stalk);
        } else {
            s.a[account].farmerGerminating.even = s.a[account].farmerGerminating.even.add(stalk);
        }

        // germinating stalk are either newly germinating, or partially germinated.
        // Thus they can only be incremented in the latest or previous season.
        uint32 season = s.season.current;
        if (LibGerminate.getSeasonGerminationState() == germ) {
            s.unclaimedGerminating[season].stalk = s.unclaimedGerminating[season].stalk.add(stalk);
        } else {
            s.unclaimedGerminating[season.sub(1)].stalk = 
                s.unclaimedGerminating[season.sub(1)].stalk
                .add(stalk);
        }

        // emit event.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            account,
            stalk
        );
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @notice Burns Stalk and Roots from `account`.
     * @dev assumes all stalk are in the same `state`. If not the case,
     * use `burnActiveStalk` and `burnGerminatingStalk` instead.
     */
    function burnStalk(address account, uint256 stalk, LibGerminate.Germinate germ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;

        // increment user and total stalk and roots if not germinating:
        if (germ == LibGerminate.Germinate.NOT_GERMINATING) {
            uint256 roots = burnActiveStalk(account, stalk);

            // Oversaturated was previously referred to as Raining and thus
            // code references mentioning Rain really refer to Oversaturation
            // If Beanstalk is Oversaturated, subtract Roots from both the
            // account's and Beanstalk's Oversaturated Roots balances.
            // For more info on Oversaturation, See {Weather.handleRain}
            if (s.season.raining) {
                s.r.roots = s.r.roots.sub(roots);
                s.a[account].sop.roots = s.a[account].roots;
            }
        } else {
            burnGerminatingStalk(account, uint128(stalk), germ);
        }
    }

    /**
     * @notice Burns stalk and roots from an account.
     */
    function burnActiveStalk(address account, uint256 stalk) internal returns (uint256 roots) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return 0;

        // Calculate the amount of Roots for the given amount of Stalk.
        roots = s.s.roots.mul(stalk).div(s.s.stalk);
        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // Decrease supply of Stalk; Remove Stalk from the balance of `account`
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);

        // emit event.
        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    /**
     * @notice Burns germinating stalk.
     * @dev Germinating stalk does not have any roots assoicated with it.
     */
    function burnGerminatingStalk(
        address account,
        uint128 stalk,
        LibGerminate.Germinate germ
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (germ == LibGerminate.Germinate.ODD) {
            s.a[account].farmerGerminating.odd = s.a[account].farmerGerminating.odd.sub(stalk);
        } else {
            s.a[account].farmerGerminating.even = s.a[account].farmerGerminating.even.sub(stalk);
        }

        // germinating stalk are either newly germinating, or partially germinated.
        // Thus they can only be decremented in the latest or previous season.
        uint32 season = s.season.current;
        if (LibGerminate.getSeasonGerminationState() == germ) {
            s.unclaimedGerminating[season].stalk = s.unclaimedGerminating[season].stalk.sub(stalk);
        } else {
            s.unclaimedGerminating[season.sub(1)].stalk = 
                s.unclaimedGerminating[season.sub(1)].stalk
                .sub(stalk);
        }

        // emit events.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            account,
            -int256(stalk)
        );
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
        roots = stalk == s.a[sender].s.stalk
            ? s.a[sender].roots
            : s.s.roots.sub(1).mul(stalk).div(s.s.stalk).add(1);

        // Subtract Stalk and Roots from the 'sender' balance.
        s.a[sender].s.stalk = s.a[sender].s.stalk.sub(stalk);
        s.a[sender].roots = s.a[sender].roots.sub(roots);
        emit StalkBalanceChanged(sender, -int256(stalk), -int256(roots));

        // Add Stalk and Roots to the 'recipient' balance.
        s.a[recipient].s.stalk = s.a[recipient].s.stalk.add(stalk);
        s.a[recipient].roots = s.a[recipient].roots.add(roots);
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
        LibGerminate.Germinate GermState
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
         // Subtract Germinating Stalk from the 'sender' balance, 
         // and Add to the 'recipient' balance.
        if (GermState == LibGerminate.Germinate.ODD) {
            s.a[sender].farmerGerminating.odd = s.a[sender].farmerGerminating.odd.sub(stalk.toUint128());
            s.a[recipient].farmerGerminating.odd = s.a[recipient].farmerGerminating.odd.add(stalk.toUint128());
        } else {
            s.a[sender].farmerGerminating.even = s.a[sender].farmerGerminating.even.sub(stalk.toUint128());
            s.a[recipient].farmerGerminating.even = s.a[recipient].farmerGerminating.even.add(stalk.toUint128());
        }

        // emit events.
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            sender,
            -int256(stalk)
        );
        emit LibGerminate.FarmerGerminatingStalkBalanceChanged(
            recipient,
            int256(stalk)
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
        uint256 stalkPerBDV = s.ss[token].stalkIssuedPerBdv;

        // a germinating deposit may have active grown stalk,
        // but no active stalk from bdv.
        if (ar.active.stalk > 0) {
            ar.active.stalk = ar.active.stalk.add(ar.active.bdv.mul(stalkPerBDV));
            transferStalk(sender, recipient, ar.active.stalk);
        }

        if (ar.odd.bdv > 0) {
            ar.odd.stalk = ar.odd.stalk.add(ar.odd.bdv.mul(stalkPerBDV));
            transferGerminatingStalk(
                sender,
                recipient,
                ar.odd.stalk,
                LibGerminate.Germinate.ODD
            );
        }

        if (ar.even.bdv > 0) {
            ar.even.stalk = ar.even.stalk.add(ar.even.bdv.mul(stalkPerBDV));
            transferGerminatingStalk(
                sender,
                recipient,
                ar.even.stalk,
                LibGerminate.Germinate.EVEN
            );
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
    function _mow(address account, address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        // if the user has not migrated from siloV2, revert.
        (bool needsMigration, uint32 lastUpdate) = migrationNeeded(account);
        require(!needsMigration, "Silo: Migration needed");

        // if the user hasn't updated prior to the seedGauge/siloV3.1 update,
        // perform a one time `lastStem` scale.
        if (
            (lastUpdate < s.season.stemScaleSeason && lastUpdate > 0) || 
            (lastUpdate == s.season.stemScaleSeason && checkStemEdgeCase(account))
        ) {
            migrateStems(account);
        }

        // sop data only needs to be updated once per season,
        // if it started raining and it's still raining, or there was a sop
        uint32 currentSeason = s.season.current;
        if (s.season.rainStart > s.season.stemStartSeason) {
            if (lastUpdate <= s.season.rainStart && lastUpdate <= currentSeason) {
                // Increments `plenty` for `account` if a Flood has occured.
                // Saves Rain Roots for `account` if it is Raining.
                handleRainAndSops(account, lastUpdate);
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
        s.a[account].lastUpdate = currentSeason;
    }

    /**
     * @dev Updates the mowStatus for the given account and token,
     * and mints Grown Stalk for the given account and token.
     */
    function __mow(
        address account,
        address token
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        int96 _stemTip = LibTokenSilo.stemTipForToken(token);
        int96 _lastStem = s.a[account].mowStatuses[token].lastStem;
        uint128 _bdv = s.a[account].mowStatuses[token].bdv;

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
        s.a[account].mowStatuses[token].lastStem = _stemTip;
        return;
    }

    /**
     * @notice returns the last season an account interacted with the silo.
     */
    function _lastUpdate(address account) internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lastUpdate;
    }

    /**
     * @dev internal logic to handle when beanstalk is raining.
     */
    function handleRainAndSops(address account, uint32 lastUpdate) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // If no roots, reset Sop counters variables
        if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.season.rainStart;
            s.a[account].lastRain = 0;
            return;
        }
        // If a Sop has occured since last update, calculate rewards and set last Sop.
        if (s.season.lastSopSeason > lastUpdate) {
            s.a[account].sop.plenty = balanceOfPlenty(account);
            s.a[account].lastSop = s.season.lastSop;
        }
        if (s.season.raining) {
            // If rain started after update, set account variables to track rain.
            if (s.season.rainStart > lastUpdate) {
                s.a[account].lastRain = s.season.rainStart;
                s.a[account].sop.roots = s.a[account].roots;
            }
            // If there has been a Sop since rain started,
            // save plentyPerRoot in case another SOP happens during rain.
            if (s.season.lastSop == s.season.rainStart) {
                s.a[account].sop.plentyPerRoot = s.sops[s.season.lastSop];
            }
        } else if (s.a[account].lastRain > 0) {
            // Reset Last Rain if not raining.
            s.a[account].lastRain = 0;
        }
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

    /**
     * @dev returns the amount of `plenty` an account has.
     */
    function balanceOfPlenty(address account) internal view returns (uint256 plenty) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Account.State storage a = s.a[account];
        plenty = a.sop.plenty;
        uint256 previousPPR;

        // If lastRain > 0, then check if SOP occured during the rain period.
        if (s.a[account].lastRain > 0) {
            // if the last processed SOP = the lastRain processed season,
            // then we use the stored roots to get the delta.
            if (a.lastSop == a.lastRain) previousPPR = a.sop.plentyPerRoot;
            else previousPPR = s.sops[a.lastSop];
            uint256 lastRainPPR = s.sops[s.a[account].lastRain];

            // If there has been a SOP duing the rain sesssion since last update, process SOP.
            if (lastRainPPR > previousPPR) {
                uint256 plentyPerRoot = lastRainPPR - previousPPR;
                previousPPR = lastRainPPR;
                plenty = plenty.add(plentyPerRoot.mul(s.a[account].sop.roots).div(C.SOP_PRECISION));
            }
        } else {
            // If it was not raining, just use the PPR at previous SOP.
            previousPPR = s.sops[s.a[account].lastSop];
        }

        // Handle and SOPs that started + ended before after last Silo update.
        if (s.season.lastSop > _lastUpdate(account)) {
            uint256 plentyPerRoot = s.sops[s.season.lastSop].sub(previousPPR);
            plenty = plenty.add(plentyPerRoot.mul(s.a[account].roots).div(C.SOP_PRECISION));
        }
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
            uint256 initalStalkRemoved,
            uint256 grownStalkRemoved,
            uint256 bdvRemoved,
            LibGerminate.Germinate germ
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        int96 stemTip;
        (germ, stemTip) = LibGerminate.getGerminationState(token, stem);
        bdvRemoved = LibTokenSilo.removeDepositFromAccount(account, token, stem, amount);

        // the inital and grown stalk are as there are instances where the inital stalk is
        // germinating, but the grown stalk is not.
        initalStalkRemoved = bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv);

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
                msg.sender, // operator
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
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256[] memory bdvsRemoved = new uint256[](stems.length);
        uint256[] memory removedDepositIDs = new uint256[](stems.length);
        LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);
        for (uint256 i; i < stems.length; ++i) {
            LibGerminate.Germinate germState = LibGerminate._getGerminationState(
                stems[i],
                germStem
            );
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
            if (germState == LibGerminate.Germinate.NOT_GERMINATING) {
                ar.active.bdv = ar.active.bdv.add(crateBdv);
                ar.active.stalk = ar.active.stalk.add(crateStalk);
                ar.active.tokens = ar.active.tokens.add(amounts[i]);
            } else {
                if (germState == LibGerminate.Germinate.ODD) {
                    ar.odd.bdv = ar.odd.bdv.add(crateBdv);
                    ar.odd.tokens = ar.odd.tokens.add(amounts[i]);
                } else {
                    ar.even.bdv = ar.even.bdv.add(crateBdv);
                    ar.even.tokens = ar.even.tokens.add(amounts[i]);
                }
                // grown stalk from germinating deposits do not germinate,
                // and thus must be added to the grown stalk.
                ar.grownStalkFromGermDeposits = ar.grownStalkFromGermDeposits.add(
                    crateStalk
                );
            }
        }

        // add inital stalk deposit to all stalk removed.
        {
            uint256 stalkIssuedPerBdv = s.ss[token].stalkIssuedPerBdv;
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
        emit TransferBatch(msg.sender, account, address(0), removedDepositIDs, amounts);
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
        uint128 reward = uint128(endStem.sub(startStem)).mul(bdv).div(PRECISION);

        return reward;
    }

    /**
     * @dev check whether the account needs to be migrated.
     */
    function migrationNeeded(address account) internal view returns (bool needsMigration, uint32 lastUpdate) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        lastUpdate = s.a[account].lastUpdate;
        needsMigration = lastUpdate > 0 && lastUpdate < s.season.stemStartSeason;
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
        if (s.s.roots == 0) return 0;

        uint256 stalk = s.s.stalk.mul(accountRoots).div(s.s.roots);

        // Beanstalk rounds down when minting Roots. Thus, it is possible that
        // balanceOfRoots / totalRoots * totalStalk < s.a[account].s.stalk.
        // As `account` Earned Balance balance should never be negative,
        // Beanstalk returns 0 instead.
        if (stalk <= accountStalk) return 0;

        // Calculate Earned Stalk and convert to Earned Beans.
        beans = (stalk - accountStalk).div(C.STALK_PER_BEAN); // Note: SafeMath is redundant here.
        if (beans > s.earnedBeans) return s.earnedBeans;

        return beans;
    }

    /**
     * @notice performs a one time update for the
     * users lastStem for all silo Tokens.
     * @dev Due to siloV3.1 update.
     */
    function migrateStems(address account) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        for(uint i; i < siloTokens.length; i++) {
            // scale lastStem by 1e6, if the user has a lastStem.
            if (s.a[account].mowStatuses[siloTokens[i]].lastStem > 0) { 
                s.a[account].mowStatuses[siloTokens[i]].lastStem = 
                    s.a[account].mowStatuses[siloTokens[i]].lastStem.mul(int96(PRECISION));
            }
        }
    }

    /**
     * @dev An edge case can occur with the siloV3.1 update, where
     * A user updates their silo in the same season as the seedGauge update,
     * but prior to the seedGauge BIP execution (i.e the farmer mowed at the start of
     * the season, and the BIP was excuted mid-way through the season).
     * This function checks for that edge case and returns a boolean.
     */
    function checkStemEdgeCase(address account) internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address[] memory siloTokens = LibWhitelistedTokens.getSiloTokens();
        // for each silo token, divide the stemTip of the token with the users last stem.
        // if the answer is 1e6 or greater, the user has not updated.
        for(uint i; i < siloTokens.length; i++) {
            int96 lastStem = s.a[account].mowStatuses[siloTokens[i]].lastStem;
            if (lastStem > 0) {
                if (LibTokenSilo.stemTipForToken(siloTokens[i]).div(lastStem) >= int96(PRECISION)) {
                    return true;
                }
            }
        }
        return false;
    }
}
