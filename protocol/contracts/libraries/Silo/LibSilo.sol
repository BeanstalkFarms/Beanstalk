/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../LibAppStorage.sol";
import {C} from "../../C.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibBytes} from "../LibBytes.sol";
import {LibPRBMath} from "../LibPRBMath.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {LibSafeMath128} from "../LibSafeMath128.sol";
import {LibSafeMathSigned96} from "../LibSafeMathSigned96.sol";

/**
 * @title LibSilo
 * @author Publius
 * @notice Contains functions for minting, burning, and transferring of
 * Stalk and Roots within the Silo.
 *
 * @dev FIXME(DISCUSS): Here, we refer to "minting" as the combination of
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
    using LibPRBMath for uint256;
    using SafeCast for uint256;
    
    // The `VESTING_PERIOD` is the number of blocks that must pass before
    // a farmer is credited with their earned beans issued that season. 
    uint256 internal constant VESTING_PERIOD = 10;
    //////////////////////// EVENTS ////////////////////////    
    uint256 constant EARNED_BEAN_VESTING_BLOCKS = 25;
     
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
    event StalkBalanceChanged(
        address indexed account,
        int256 delta,
        int256 deltaRoots
    );

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

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
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
     */
    function mintStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots;
        if (s.s.roots == 0) {
            roots = uint256(stalk.mul(C.getRootsBase()));
        } else {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
        }
        
        
        // increment user and total stalk
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // increment user and total roots
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);


        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }


    /**
     * @dev mints grownStalk to `account`.
     * 
     * per the zero-withdraw update, if a user plants during the vesting period (see constant),
     * the earned beans of the current season is deferred until the non vesting period.
     * However, this causes a slight mismatch in the amount of roots to properly allocate to the user.
     * 
     * The formula for calculating the roots is:
     * GainedRoots = TotalRoots * GainedStalk / TotalStalk.
     * 
     * Roots are utilized in {SiloExit.balanceOfEarnedBeans} to calculate the earned beans as such: 
     * EarnedBeans = (TotalStalk * userRoots / TotalRoots) - userStalk  
     * 
     * Because TotalStalk increments when there are new beans issued (at sunrise), 
     * the amount of roots issued without the earned beans are:
     * GainedRoots = TotalRoots * GainedStalk / (TotalStalk - NewEarnedStalk)
     * 
     * since newEarnedStalk is always equal or greater than 0, the gained roots calculated without the earned beans
     * will always be equal or larger than the gained roots calculated with the earned beans.
     * 
     * @param account the address to mint Stalk and Roots to
     * @param stalk the amount of stalk to mint
     */
    function mintGrownStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 roots;
        if (s.s.roots == 0) {
            roots = stalk.mul(C.getRootsBase());
        } else  {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
            if (inVestingPeriod()) {
                // Safe Math is unnecessary for because total Stalk > new Earned Stalk
                uint256 rootsWithoutEarned = s.s.roots.add(s.vestingPeriodRoots).mul(stalk).div(s.s.stalk - s.newEarnedStalk);
                // Safe Math is unnecessary for because rootsWithoutEarned >= roots
                uint128 deltaRoots = (rootsWithoutEarned - roots).toUint128();
                s.vestingPeriodRoots = s.vestingPeriodRoots.add(deltaRoots);
                s.a[account].deltaRoots = deltaRoots;
            }
        }

        // increment user and total stalk
        s.s.stalk = s.s.stalk.add(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.add(stalk);

        // increment user and total roots
        s.s.roots = s.s.roots.add(roots);
        s.a[account].roots = s.a[account].roots.add(roots);

        emit StalkBalanceChanged(account, int256(stalk), int256(roots));
    }

    //////////////////////// BURN ////////////////////////

    /**
     * @dev Burns Stalk and Roots from `account`.
     *
     * if the user withdraws in the vesting period, 
     * they forfeit their earned beans for that season, 
     * distrubuted to the other users.
     */
    function burnStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;
       
        uint256 roots;
        // Calculate the amount of Roots for the given amount of Stalk.
        // We round up as it prevents an account having roots but no stalk.
        
        // if the user withdraws in the vesting period, they forfeit their earned beans for that season
        // this is distrubuted to the other users.
        if(block.number - s.season.sunriseBlock <= EARNED_BEAN_VESTING_BLOCKS){
            roots = s.s.roots.mulDiv(
            stalk,
            s.s.stalk-s.newEarnedStalk,
            LibPRBMath.Rounding.Up);

        } else { 
            roots = s.s.roots.mulDiv(
            stalk,
            s.s.stalk,
            LibPRBMath.Rounding.Up);
        }

        if (roots > s.a[account].roots) roots = s.a[account].roots;

        // Decrease supply of Stalk; Remove Stalk from the balance of `account`
        s.s.stalk = s.s.stalk.sub(stalk);
        s.a[account].s.stalk = s.a[account].s.stalk.sub(stalk);

        // Decrease supply of Roots; Remove Roots from the balance of `account`
        s.s.roots = s.s.roots.sub(roots);
        s.a[account].roots = s.a[account].roots.sub(roots);
        
        // If it is Raining, subtract Roots from both the account's and 
        // Beanstalk's RainRoots balances.
        // For more info on Rain, see {FIXME(doc)}. 
        if (s.season.raining) {
            s.r.roots = s.r.roots.sub(roots);
            s.a[account].sop.roots = s.a[account].roots;
        }

        emit StalkBalanceChanged(account, -int256(stalk), -int256(roots));
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @notice Decrements the Stalk and Roots of `sender` and increments the Stalk
     * and Roots of `recipient` by the same amount.
     */
    function transferStalk(
        address sender,
        address recipient,
        uint256 stalk
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // (Fixme?) Calculate the amount of Roots for the given amount of Stalk.
        uint256 roots = stalk == s.a[sender].s.stalk
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

        require(!LibSilo.migrationNeeded(account), "Silo: Migration needed");

        AppStorage storage s = LibAppStorage.diamondStorage();
        //sop stuff only needs to be updated once per season
        //if it started raininga nd it's still raining, or there was a sop
        if (s.season.rainStart > s.season.stemStartSeason) {
            uint32 _lastUpdate = lastUpdate(account);
            if (_lastUpdate <= s.season.rainStart && _lastUpdate <= s.season.current) {
                // Increments `plenty` for `account` if a Flood has occured.
                // Saves Rain Roots for `account` if it is Raining.
                handleRainAndSops(account, _lastUpdate);

                // Reset timer so that Grown Stalk for a particular Season can only be 
                // claimed one time. 
                s.a[account].lastUpdate = s.season.current;
            }
        }
        
        // Calculate the amount of Grown Stalk claimable by `account`.
        // Increase the account's balance of Stalk and Roots.
        __mow(account, token);

        // was hoping to not have to update lastUpdate, but if you don't, then it's 0 for new depositors, this messes up mow and migrate in unit tests, maybe better to just set this manually for tests?
        // anyone that would have done any deposit has to go through mowSender which would have init'd it above zero in the pre-migration days
        s.a[account].lastUpdate = s.season.current;
    }

    /**
     * @dev Updates the mowStatus for the given account and token, 
     * and mints Grown Stalk for the given account and token.
     */
    function __mow(address account, address token) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        int96 _stemTip = LibTokenSilo.stemTipForToken(token);
        int96 _lastStem =  s.a[account].mowStatuses[token].lastStem;
        uint128 _bdv = s.a[account].mowStatuses[token].bdv;
        
        // if 
        // 1: account has no bdv (new token deposit)
        // 2: the lastStem is the same as the stemTip (implying that a user has mowed),
        // then skip calculations to save gas.
        if (_bdv > 0) {
            if (_lastStem == _stemTip) {
                return;
            }

            LibSilo.mintGrownStalk(
                account,
                _balanceOfGrownStalk(
                    _lastStem,
                    _stemTip,
                    _bdv
                )
            );
        }

        // If this `account` has no BDV, skip to save gas. Still need to update lastStem 
        // (happen on initial deposit, since mow is called before any deposit)
        s.a[account].mowStatuses[token].lastStem = _stemTip;
        return;
    }

    /**
     * @notice returns the last season an account interacted with the silo.
     */
    function lastUpdate(address account) internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lastUpdate;
    }

    /**
     * @dev internal logic to handle when beanstalk is raining.
     * FIXME(refactor): replace `lastUpdate()` -> `_lastUpdate()` and rename this param?
     */
    function handleRainAndSops(address account, uint32 _lastUpdate) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // If no roots, reset Sop counters variables
        if (s.a[account].roots == 0) {
            s.a[account].lastSop = s.season.rainStart;
            s.a[account].lastRain = 0;
            return;
        }
        // If a Sop has occured since last update, calculate rewards and set last Sop.
        if (s.season.lastSopSeason > _lastUpdate) {
            s.a[account].sop.plenty = balanceOfPlenty(account);
            s.a[account].lastSop = s.season.lastSop;
        }
        if (s.season.raining) {
            // If rain started after update, set account variables to track rain.
            if (s.season.rainStart > _lastUpdate) {
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
    ) internal pure returns (uint256)
    {
        return stalkReward(lastStem, latestStem, bdv);
    } 

    /**
     * @dev returns the amount of `plenty` an account has.
     */
    function balanceOfPlenty(address account)
        internal
        view
        returns (uint256 plenty)
    {
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
                plenty = plenty.add(
                    plentyPerRoot.mul(s.a[account].sop.roots).div(
                        C.SOP_PRECISION
                    )
                );
            }
        } else {
            // If it was not raining, just use the PPR at previous SOP.
            previousPPR = s.sops[s.a[account].lastSop];
        }

        // Handle and SOPs that started + ended before after last Silo update.
        if (s.season.lastSop > lastUpdate(account)) {
            uint256 plentyPerRoot = s.sops[s.season.lastSop].sub(previousPPR);
            plenty = plenty.add(
                plentyPerRoot.mul(s.a[account].roots).div(
                    C.SOP_PRECISION
                )
            );
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
            uint256 stalkRemoved,
            uint256 bdvRemoved
        )
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        bdvRemoved = LibTokenSilo.removeDepositFromAccount(account, token, stem, amount);

        //need to get amount of stalk earned by this deposit (index of now minus index of when deposited)
        stalkRemoved = bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(
                stem, //this is the index of when it was deposited
                LibTokenSilo.stemTipForToken(token), //this is latest for this token
                bdvRemoved.toUint128()
            )
        );
        /** 
         *  {_removeDepositFromAccount} is used for both withdrawing and transferring deposits.
         *  In the case of a withdraw, only the {TransferSingle} Event needs to be emitted.
         *  In the case of a transfer, a different {TransferSingle}/{TransferBatch} 
         *  Event is emitted in {TokenSilo._transferDeposit(s)}, 
         *  and thus, this event is ommited.
         */
        if(transferType == LibTokenSilo.Transfer.emitTransferSingle){
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
     */
    function _removeDepositsFromAccount(
        address account,
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        //make bdv array and add here?
        uint256[] memory bdvsRemoved = new uint256[](stems.length);
        uint256[] memory removedDepositIDs = new uint256[](stems.length);

        for (uint256 i; i < stems.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                account,
                token,
                stems[i],
                amounts[i]
            );
            bdvsRemoved[i] = crateBdv;
            removedDepositIDs[i] = LibBytes.packAddressAndStem(token, stems[i]);
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);

            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    stems[i],
                    LibTokenSilo.stemTipForToken(token),
                    crateBdv.toUint128()
                )
            );

        }

        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv)
        );

        // "removing" deposits is equivalent to "burning" a batch of ERC1155 tokens.
        emit TransferBatch(msg.sender, account, address(0), removedDepositIDs, amounts);
        emit RemoveDeposits(account, token, stems, amounts, ar.tokensRemoved, bdvsRemoved);
    }

    
    //////////////////////// UTILITIES ////////////////////////

    /**
     * @dev Calculates the Stalk reward based on the start and end
     * stems, and the amount of BDV deposited. Stems represent the
     * amount of grown stalk per BDV, so the difference between the 
     * start index and end index (stem) multiplied by the amount of
     * bdv deposited will give the amount of stalk earned.
     * formula: stalk = bdv * (ΔstalkPerBdv)
     */
    function stalkReward(int96 startStem, int96 endStem, uint128 bdv) //are the types what we want here?
        internal
        pure
        returns (uint256)
    {
        int96 reward = endStem.sub(startStem).mul(int96(bdv));
        
        return uint128(reward);
    }

    /**
     * @dev check whether beanstalk is in the vesting period:
     */
    function inVestingPeriod() internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return block.number - s.season.sunriseBlock <= VESTING_PERIOD;
    }

    function migrationNeeded(address account) internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lastUpdate > 0 && s.a[account].lastUpdate < s.season.stemStartSeason;
    }
}