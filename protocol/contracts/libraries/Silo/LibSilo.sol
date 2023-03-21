/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../../C.sol";
import "../LibAppStorage.sol";
import "../LibPRBMath.sol";
import "~/libraries/LibSafeMathSigned96.sol";
import "../LibSafeMath128.sol";
import {LibBytes} from "../LibBytes.sol";
import "./LibTokenSilo.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";

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
    // using SafeMath for uint128;
    using LibSafeMath128 for uint128;
    using LibSafeMathSigned96 for int96;
    using LibPRBMath for uint256;
    using SafeCast for uint256;
    
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

    // 
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

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

    // ERC1155 events

    /**
     * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
     */
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

    /**
     * @dev Equivalent to multiple {TransferSingle} events, where `operator`, `from` and `to` are the same for all
     * transfers.
     */
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);

    //////////////////////// MINT ////////////////////////

    /**
     * @dev Mints Stalk and Roots to `account`.
     *
     * For an explanation of Roots accounting, see {FIXME(doc)}.
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
     * per the zero-withdraw update, if a user plants during the morning,
     * the roots needed to properly calculate the earned beans would be higher 
     * than outside the morning. Thus, if a user mows in the morning, 
     * additional calculation is done and stored for the {plant} function.
     * @param account farmer
     * @param stalk the amount of stalk to mint
     */
    function mintGrownStalkAndGrownRoots(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 roots;
        if (s.s.roots == 0) {
            roots = stalk.mul(C.getRootsBase());
        } else  {
            roots = s.s.roots.mul(stalk).div(s.s.stalk);
            if (block.number - s.season.sunriseBlock <= EARNED_BEAN_VESTING_BLOCKS) {
                uint256 rootsWithoutEarned = s.s.roots.add(s.vestingPeriodRoots).mul(stalk).div(s.s.stalk - (s.newEarnedStalk));
                uint256 deltaRoots = rootsWithoutEarned - roots;
                s.vestingPeriodRoots = s.vestingPeriodRoots.add(uint128(deltaRoots));
                s.a[account].deltaRoots = uint128(deltaRoots);
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
     * For an explanation of Roots accounting, see {FIXME(doc)}.
     */
    function burnStalk(address account, uint256 stalk) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        if (stalk == 0) return;
       
        uint256 roots;
        // Calculate the amount of Roots for the given amount of Stalk.
        // We round up as it prevents an account having roots but no stalk.
        
        // if the user withdraws in the same block as sunrise, they forfeit their earned beans for that season
        // this is distrubuted to the other users.
        // should this be the same as the vesting period?
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
     * @dev Decrements the Stalk and Roots of `sender` and increments the Stalk
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
     * balance.
     *
     * 
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
        uint32 _lastUpdate = lastUpdate(account);

        //if last update > 0 and < stemStartSeason
        //require that user account seeds be zero
        // require(_lastUpdate > 0 && _lastUpdate >= s.season.stemStartSeason, 'silo migration needed'); //will require storage cold read... is there a better way?

        //maybe instead of checking lastUpdate here, which is no longer used going forwards since mowStatus will keep track of each individual "last mow time" by storing the stem tip at time of mow

        

        if((_lastUpdate != 0) && (_lastUpdate < s.season.stemStartSeason)) revert('silo migration needed');


        //sop stuff only needs to be updated once per season
        //if it started raininga nd it's still raining, or there was a sop
        if (s.season.rainStart > s.season.stemStartSeason) {
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

        //was hoping to not have to update lastUpdate, but if you don't, then it's 0 for new depositors, this messes up mow and migrate in unit tests, maybe better to just set this manually for tests?
        //anyone that would have done any deposit has to go through mowSender which would have init'd it above zero in the pre-migration days
        s.a[account].lastUpdate = s.season.current;
    }

    function __mow(address account, address token) private {
        AppStorage storage s = LibAppStorage.diamondStorage();

        int96 _stemTip = LibTokenSilo.stemTipForToken(IERC20(token));
        int96 _lastStem =  s.a[account].mowStatuses[token].lastStem;
        uint128 _bdv = s.a[account].mowStatuses[token].bdv;
        
        if (_bdv > 0) {
             // if account mowed the same token in the same season, skip
            if (_lastStem == _stemTip) {
                return;
            }

            // per the zero withdraw update, if a user plants within the morning, 
            // addtional roots will need to be issued, to properly calculate the earned beans. 
            // thus, a different mint stalk function is used to differ between deposits.
            LibSilo.mintGrownStalkAndGrownRoots(
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

    function lastUpdate(address account) internal view returns (uint32) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].lastUpdate;
    }

    /**
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

    function _balanceOfGrownStalk(
        int96 lastStem,
        int96 endStalkPerBDV,
        uint128 bdv
    ) internal pure returns (uint256)
    {
        return
            stalkReward(
                lastStem, //last GSPBDV farmer mowed
                endStalkPerBDV, //get latest grown stalk per bdv for this token
                bdv
            );
    } 

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
                        C.getSopPrecision()
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
                    C.getSopPrecision()
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
        uint256 amount
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
                LibTokenSilo.stemTipForToken(IERC20(token)), //this is latest for this token
                bdvRemoved.toUint128()
            )
        );

        // "removing" a deposit is equivalent to "burning" an ERC1155 token.
        emit TransferSingle(
            msg.sender, // operator
            account, // from
            address(0), // to
            uint256(LibBytes.packAddressAndStem(token, stem)), // id
            amount // amount
        );
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
            removedDepositIDs[i] = uint256(LibBytes.packAddressAndStem(token, stems[i]));
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);

            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    stems[i],
                    LibTokenSilo.stemTipForToken(IERC20(token)),
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
     * This function will take in a start stalk per bdv, end stalk per bdv,
     * and the deposited bdv amount, and return
     *
     */
    function stalkReward(int96 startStalkPerBDV, int96 endStalkPerBDV, uint128 bdv) //are the types what we want here?
        internal
        pure
        returns (uint256)
    {
        
        // 
        
        // 
        
        int96 reward = endStalkPerBDV.sub(startStalkPerBDV).mul(int96(bdv));
        
        return uint128(reward);
    }

    //at the moment this is only used for MockSiloFacet - remove somehow? just do seeds.mul(seasons) there?
    function stalkRewardLegacy(uint256 seeds, uint32 seasons)
        internal
        pure
        returns (uint256)
    {
        return seeds.mul(seasons);
    }

}