/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../../C.sol";
import "./LibUnripeSilo.sol";
import "./LibLegacyTokenSilo.sol";
import "~/libraries/LibSafeMathSigned128.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";

/**
 * @title LibTokenSilo
 * @author Publius
 * @notice Contains functions for depositing, withdrawing and claiming
 * whitelisted Silo tokens.
 *
 * For functionality related to Stalk, and Roots, see {LibSilo}.
 */
library LibTokenSilo {
    using SafeMath for uint256;
    using SafeMath for int128;
    using SafeMath for uint32;
    using LibSafeMathSigned128 for int128;
    using SafeCast for int128;

    //////////////////////// EVENTS ////////////////////////

    /**
     * @dev IMPORTANT: copy of {TokenSilo-AddDeposit}, check there for details.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        int128 grownStalkPerBdv,
        uint256 amount,
        uint256 bdv
    );

    //////////////////////// ACCOUNTING: TOTALS ////////////////////////
    
    /**
     * @dev Increment the total amount of `token` deposited in the Silo.
     */
    function incrementTotalDeposited(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.add(
            amount
        );
    }

    /**
     * @dev Decrement the total amount of `token` deposited in the Silo.
     */
    function decrementTotalDeposited(address token, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.sub(
            amount
        );
    }

    //////////////////////// ADD DEPOSIT ////////////////////////

    /**
     * @return stalk The amount of Stalk received for this Deposit.
     * 
     * @dev Calculate the current BDV for `amount` of `token`, then perform 
     * Deposit accounting.
     */
    function deposit(
        address account,
        address token,
        int128 grownStalkPerBdv,
        uint256 amount
    ) internal returns (uint256) {
        uint256 bdv = beanDenominatedValue(token, amount);
        return depositWithBDV(account, token, grownStalkPerBdv, amount, bdv);
    }

    /**
     * @dev Once the BDV received for Depositing `amount` of `token` is known, 
     * add a Deposit for `account` and update the total amount Deposited.
     *
     * `s.ss[token].stalkPerBdv` stores the number of Stalk per BDV for `token`.
     *
     * FIXME(discuss): If we think of Deposits like 1155s, we might call the
     * combination of "incrementTotalDeposited" and "addDepositToAccount" as 
     * "minting a deposit".
     */
    function depositWithBDV(
        address account,
        address token,
        int128 grownStalkPerBdv,
        uint256 amount,
        uint256 bdv
    ) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bdv > 0, "Silo: No Beans under Token.");

        incrementTotalDeposited(token, amount); // Update Totals

        addDepositToAccount(account, token, grownStalkPerBdv, amount, bdv); // Add to Account

        return (
            bdv.mul(s.ss[token].stalkPerBdv) //formerly stalk
        );
    }

    /**
     * @dev Add `amount` of `token` to a user's Deposit in `cumulativeGrownStalkPerBdv`. Requires a
     * precalculated `bdv`.
     *
     * If a Deposit doesn't yet exist, one is created. Otherwise, the existing
     * Deposit is updated.
     * 
     * `amount` & `bdv` are cast uint256 -> uint128 to optimize storage cost,
     * since both values can be packed into one slot.
     * 
     * Unlike {removeDepositFromAccount}, this function DOES EMIT an 
     * {AddDeposit} event. See {removeDepositFromAccount} for more details.
     */
    function addDepositToAccount(
        address account,
        address token,
        int128 grownStalkPerBdv,
        uint256 amount,
        uint256 bdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        s.a[account].deposits[token][grownStalkPerBdv].amount += uint128(amount); //need safecast here?
        s.a[account].deposits[token][grownStalkPerBdv].bdv += uint128(bdv); //need safecast here?

        //setup or update the MowStatus for this deposit. We should have _just_ mowed before calling this function.
        s.a[account].mowStatuses[token].lastCumulativeGrownStalkPerBDV = grownStalkPerBdv; //maybe updating this here is not totally necessary if we just mowed?
        s.a[account].mowStatuses[token].bdv += uint128(bdv); //need safecast here?

        //add to account-level total token deposited total amount inside the MowStatus



        emit AddDeposit(account, token, grownStalkPerBdv, amount, bdv);
    }

    //////////////////////// REMOVE DEPOSIT ////////////////////////

    /**
     * @dev Remove `amount` of `token` from a user's Deposit in `grownStalkPerBdv`.
     *
     * A "Crate" refers to the existing Deposit in storage at:
     *  `s.a[account].deposits[token][grownStalkPerBdv]`
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
        int128 grownStalkPerBdv,
        uint256 amount
    ) internal returns (uint256 crateBDV) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        uint256 crateAmount;
        (crateAmount, crateBDV) = (
            s.a[account].deposits[token][grownStalkPerBdv].amount,
            s.a[account].deposits[token][grownStalkPerBdv].bdv
        );

        // Partial remove
        if (amount < crateAmount) {
            uint256 removedBDV = amount.mul(crateBDV).div(crateAmount);
            uint256 updatedBDV = uint256(s.a[account].deposits[token][grownStalkPerBdv].bdv)
                .sub(removedBDV);
            uint256 updatedAmount = uint256(s.a[account].deposits[token][grownStalkPerBdv].amount)
                .sub(amount);
                
            require(
                updatedBDV <= uint128(-1) && updatedAmount <= uint128(-1),
                "Silo: uint128 overflow."
            );

            s.a[account].deposits[token][grownStalkPerBdv].amount = uint128(updatedAmount);
            s.a[account].deposits[token][grownStalkPerBdv].bdv = uint128(updatedBDV);

            //remove from the mow status bdv amount, which keeps track of total token deposited per farmer
            s.a[account].mowStatuses[token].bdv -= uint128(removedBDV); //need some kind of safety check here?

            return removedBDV;
        }

        // Full remove
        if (crateAmount > 0) delete s.a[account].deposits[token][grownStalkPerBdv];

        s.a[account].mowStatuses[token].bdv -= uint128(crateAmount);

        // Excess remove
        // This can only occur for Unripe Beans and Unripe LP Tokens, and is a
        // result of using Silo V1 storage slots to store Unripe BEAN/LP
        // Deposit information. See {AppStorage.sol:Account-State}.
        if (amount > crateAmount) {
            amount -= crateAmount;
            
            uint32 season = LibLegacyTokenSilo.grownStalkPerBdvToSeason(IERC20(token), grownStalkPerBdv);
            LibLegacyTokenSilo.removeDepositFromAccount(account, token, season, amount);
        }
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @dev Calculate the BDV ("Bean Denominated Value") for `amount` of `token`.
     * 
     * Makes a call to a BDV function defined in the SiloSettings for this 
     * `token`. See {AppStorage.sol:Storage-SiloSettings} for more information.
     */
    function beanDenominatedValue(address token, uint256 amount)
        internal
        returns (uint256 bdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // BDV functions accept one argument: `uint256 amount`
        bytes memory callData = abi.encodeWithSelector(
            s.ss[token].selector,
            amount
        );

        (bool success, bytes memory data) = address(this).call(
            callData
        );

        if (!success) {
            if (data.length == 0) revert();
            assembly {
                revert(add(32, data), mload(data))
            }
        }

        assembly {
            bdv := mload(add(data, add(0x20, 0)))
        }
    }

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
        int128 grownStalkPerBdv
    ) internal view returns (uint256 amount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        amount = s.a[account].deposits[token][grownStalkPerBdv].amount;
        bdv = s.a[account].deposits[token][grownStalkPerBdv].bdv;
        if (LibLegacyTokenSilo.isDepositSeason(IERC20(token), grownStalkPerBdv)) {
            (uint legacyAmount, uint legacyBdv) =
                LibLegacyTokenSilo.tokenDeposit(account, address(token), LibLegacyTokenSilo.grownStalkPerBdvToSeason(IERC20(token), grownStalkPerBdv));
            amount = amount.add(legacyAmount);
            bdv = bdv.add(legacyBdv);
        }
    }
    /**
     * @dev Get the number of Stalk per BDV per Season for a whitelisted token. Formerly just seeds.
     */
    function stalkPerBdvPerSeason(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalkPerBdvPerSeason);
    }

    /**
     * @dev Get the number of Stalk per BDV for a whitelisted token. Formerly just stalk.
     */
    function stalkPerBdv(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalkPerBdv);
    }

    function cumulativeGrownStalkPerBdv(IERC20 token)
        internal
        view
        returns (int128 _cumulativeGrownStalkPerBdv)
    {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // SiloSettings storage ss = s.ss[token]; //tried to use this, but I get `DeclarationError: Identifier not found or not unique.`
        _cumulativeGrownStalkPerBdv = s.ss[address(token)].lastCumulativeGrownStalkPerBdv.add(
            int128(s.ss[address(token)].stalkPerBdvPerSeason.mul(s.season.current.sub(s.ss[address(token)].lastUpdateSeason)))
        );
    }

    function grownStalkForDeposit(
        address account,
        IERC20 token,
        int128 grownStalkPerBdv
    )
        internal
        view
        returns (uint grownStalk)
    {
        // cumulativeGrownStalkPerBdv(token) > depositGrownStalkPerBdv for all valid Deposits
        AppStorage storage s = LibAppStorage.diamondStorage();
        int128 _cumulativeGrownStalkPerBdv = cumulativeGrownStalkPerBdv(token);
        require(grownStalkPerBdv <= _cumulativeGrownStalkPerBdv, "Silo: Invalid Deposit");
        uint deltaGrownStalkPerBdv = uint(cumulativeGrownStalkPerBdv(token).sub(grownStalkPerBdv));
        (, uint bdv) = tokenDeposit(account, address(token), grownStalkPerBdv);
        grownStalk = deltaGrownStalkPerBdv.mul(bdv);
    }

        function grownStalkAndBdvToCumulativeGrownStalk(IERC20 token, uint256 grownStalk, uint256 bdv)
        public
        view
        returns (int128 cumulativeGrownStalk)
    {
        //first get current latest grown stalk index
        int128 latestCumulativeGrownStalkPerBdvForToken = LibTokenSilo.cumulativeGrownStalkPerBdv(token);
        //then calculate how much stalk each individual bdv has grown
        int128 grownStalkPerBdv = int128(grownStalk.div(bdv));
        //then subtract from the current latest index, so we get the index the deposit should have happened at
        return latestCumulativeGrownStalkPerBdvForToken.sub(grownStalkPerBdv);
    }
}
