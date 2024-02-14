/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {LibAppStorage, Storage, AppStorage, Account} from "../LibAppStorage.sol";
import {C} from "../../C.sol";
import {LibSafeMath32} from "contracts/libraries/LibSafeMath32.sol";
import {LibSafeMath128} from "contracts/libraries/LibSafeMath128.sol";
import {LibSafeMathSigned128} from "contracts/libraries/LibSafeMathSigned128.sol";
import {LibSafeMathSigned96} from "contracts/libraries/LibSafeMathSigned96.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";
import {LibGerminate} from "contracts/libraries/Silo/LibGerminate.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

/**
 * @title LibTokenSilo
 * @author Publius, Pizzaman1337
 * @notice Contains functions for depositing, withdrawing and claiming
 * whitelisted Silo tokens.
 *
 * For functionality related to Stalk, and Roots, see {LibSilo}.
 */
library LibTokenSilo {
    using SafeMath for uint256;
    using LibSafeMath128 for uint128;
    using LibSafeMath32 for uint32;
    using LibSafeMathSigned128 for int128;
    using SafeCast for int128;
    using SafeCast for uint256;
    using LibSafeMathSigned96 for int96;

    uint256 constant PRECISION = 1e6; // increased precision from to silo v3.1.


    //////////////////////// ENUM ////////////////////////
    /**
     * @dev when a user deposits or withdraws a deposit, the
     * {TrasferSingle} event is emitted. However, in the case
     * of a transfer, this emission is ommited. This enum is
     * used to determine if the event should be emitted.
     */
    enum Transfer {
        emitTransferSingle,
        noEmitTransferSingle
    }

    //////////////////////// EVENTS ////////////////////////

    /**
     * @dev IMPORTANT: copy of {TokenSilo-AddDeposit}, check there for details.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @dev IMPORTANT: copy of {TokenSilo-RemoveDeposit}, check there for details.
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    // added as the ERC1155 deposit upgrade
    event TransferSingle(
        address indexed operator,
        address indexed sender,
        address indexed recipient,
        uint256 depositId,
        uint256 amount
    );

    //////////////////////// ACCOUNTING: TOTALS GERMINATING ////////////////////////

    /**
     * @notice Increment the total amount and bdv of `token` germinating in the Silo.
     * @dev when an asset is `deposited` in the silo, it is not immediately eliable for
     * bean mints. It must `germinate` (stay deposited the silo) for a certain
     * amount of seasons (the remainer of the current season + 1). This function
     * increments the total amount and bdv germinating in the silo. The {sunrise}
     * function ends the germination process for even or odd germinating deposits.
     *
     * This protects beanstalk from flashloan attacks, and makes `totalDeposited` and
     * `totalDepositedBdv` significantly more MEV resistant.
     */
    function incrementTotalGerminating(
        address token,
        uint256 amount,
        uint256 bdv,
        LibGerminate.Germinate germ
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.TotalGerminating storage germinate;

        // verify germ is valid
        if (germ == LibGerminate.Germinate.ODD) {
            germinate = s.oddGerminating;
        } else if (germ == LibGerminate.Germinate.EVEN) {
            germinate = s.evenGerminating;
        } else {
            revert("invalid germinationMode"); // should not ever get here
        }

        // increment germinating amount and bdv.
        germinate.deposited[token].amount = germinate.deposited[token].amount.add(
            amount.toUint128()
        );
        germinate.deposited[token].bdv = germinate.deposited[token].bdv.add(bdv.toUint128());

        // emit event.
        emit LibGerminate.TotalGerminatingBalanceChanged(
            s.season.current,
            token,
            int256(amount),
            int256(bdv)
        );
    }

    /**
     * @notice Decrement the total amount and bdv of `token` germinating in the Silo.
     * @dev `decrementTotalGerminating` should be used when removing deposits
     * that are < 2 seasons old.
     */
    function decrementTotalGerminating(
        address token,
        uint256 amount,
        uint256 bdv,
        LibGerminate.Germinate germ
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        Storage.TotalGerminating storage germinate;

        // verify germ is valid
        if (germ == LibGerminate.Germinate.ODD) {
            germinate = s.oddGerminating;
        } else if (germ == LibGerminate.Germinate.EVEN) {
            germinate = s.evenGerminating;
        } else {
            revert("invalid germinationMode"); // should not ever get here
        }

        // decrement germinating amount and bdv.
        germinate.deposited[token].amount = germinate.deposited[token].amount.sub(
            amount.toUint128()
        );
        germinate.deposited[token].bdv = germinate.deposited[token].bdv.sub(bdv.toUint128());

        emit LibGerminate.TotalGerminatingBalanceChanged(
            LibGerminate.getSeasonGerminationState() == germ ? 
                s.season.current : 
                s.season.current - 1,
            token,
            -int256(amount),
            -int256(bdv)
        );
    }

    /**
     * @notice Increment the total bdv of `token` germinating in the Silo. Used in Enroot.
     */
    function incrementTotalGerminatingBdv(
        address token,
        uint256 bdv,
        LibGerminate.Germinate germ
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (germ == LibGerminate.Germinate.ODD) {
            // increment odd germinating
            s.oddGerminating.deposited[token].bdv = s.oddGerminating.deposited[token].bdv.add(
                bdv.toUint128()
            );
        } else if (germ == LibGerminate.Germinate.EVEN) {
            // increment even germinating
            s.evenGerminating.deposited[token].bdv = s.evenGerminating.deposited[token].bdv.add(
                bdv.toUint128()
            );
        } else {
            revert("invalid germinationMode"); // should not ever get here
        }

        emit LibGerminate.TotalGerminatingBalanceChanged(
            LibGerminate.getSeasonGerminationState() == germ ? 
                s.season.current : 
                s.season.current - 1,
            token,
            0,
            int256(bdv)
        );
    }

    //////////////////////// ACCOUNTING: TOTALS ////////////////////////

    /**
     * @dev Increment the total amount and bdv of `token` deposited in the Silo.
     * @dev `IncrementTotalDeposited` should be used when removing deposits that are
     * >= 2 seasons old (ex. when a user converts).
     */
    function incrementTotalDeposited(address token, uint256 amount, uint256 bdv) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.add(amount.toUint128());
        s.siloBalances[token].depositedBdv = s.siloBalances[token].depositedBdv.add(
            bdv.toUint128()
        );
    }

    /**
     * @notice Decrement the total amount and bdv of `token` deposited in the Silo.
     * @dev `decrementTotalDeposited` should be used when removing deposits that are
     * >= 2 seasons old.
     */
    function decrementTotalDeposited(address token, uint256 amount, uint256 bdv) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].deposited = s.siloBalances[token].deposited.sub(amount.toUint128());
        s.siloBalances[token].depositedBdv = s.siloBalances[token].depositedBdv.sub(
            bdv.toUint128()
        );
    }

    /**
     * @notice Increment the total bdv of `token` deposited in the Silo. Used in Enroot.
     */
    function incrementTotalDepositedBdv(address token, uint256 bdv) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.siloBalances[token].depositedBdv = s.siloBalances[token].depositedBdv.add(
            bdv.toUint128()
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
        int96 stem,
        uint256 amount
    ) internal returns (uint256, LibGerminate.Germinate) {
        uint256 bdv = beanDenominatedValue(token, amount);
        return depositWithBDV(account, token, stem, amount, bdv);
    }

    /**
     * @dev Once the BDV received for Depositing `amount` of `token` is known,
     * add a Deposit for `account` and update the total amount Deposited.
     *
     * `s.ss[token].stalkIssuedPerBdv` stores the number of Stalk per BDV for `token`.
     */
    function depositWithBDV(
        address account,
        address token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    ) internal returns (uint256 stalk, LibGerminate.Germinate germ) {
        require(bdv > 0, "Silo: No Beans under Token.");
        AppStorage storage s = LibAppStorage.diamondStorage();

        // determine whether the deposit is odd or even germinating
        germ = LibGerminate.getSeasonGerminationState();

        // all new deposits will increment total germination.
        incrementTotalGerminating(token, amount, bdv, germ);
        
        addDepositToAccount(
            account,
            token,
            stem,
            amount,
            bdv,
            Transfer.emitTransferSingle
        );

        stalk = bdv.mul(s.ss[token].stalkIssuedPerBdv);
    }

    /**
     * @dev Add `amount` of `token` to a user's Deposit in `stemTipForToken`. Requires a
     * precalculated `bdv`.
     *
     * If a Deposit doesn't yet exist, one is created. Otherwise, the existing
     * Deposit is updated.
     *
     * `amount` & `bdv` are downcasted uint256 -> uint128 to optimize storage cost,
     * since both values can be packed into one slot.
     *
     * Unlike {removeDepositFromAccount}, this function DOES EMIT an
     * {AddDeposit} event. See {removeDepositFromAccount} for more details.
     *
     * If a deposit is 'germinating', increment the germinating bdv for a user.
     * Otherwise, increment the mow status bdv for a user.
     */
    function addDepositToAccount(
        address account,
        address token,
        int96 stem,
        uint256 amount,
        uint256 bdv,
        Transfer transferType
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 depositId = LibBytes.packAddressAndStem(token, stem);

        // add amount and bdv to the deposits.
        s.a[account].deposits[depositId].amount = s.a[account].deposits[depositId].amount.add(
            amount.toUint128()
        );
        s.a[account].deposits[depositId].bdv = s.a[account].deposits[depositId].bdv.add(
            bdv.toUint128()
        );

        // SafeMath unnecessary b/c crateBDV <= type(uint128).max
        s.a[account].mowStatuses[token].bdv = s.a[account].mowStatuses[token].bdv.add(
            bdv.toUint128()
        );

        /**
         *  {addDepositToAccount} is used for both depositing and transferring deposits.
         *  In the case of a deposit, only the {TransferSingle} Event needs to be emitted.
         *  In the case of a transfer, a different {TransferSingle}/{TransferBatch}
         *  Event is emitted in {TokenSilo._transferDeposit(s)},
         *  and thus, this event is ommited.
         */
        if (transferType == Transfer.emitTransferSingle) {
            emit TransferSingle(
                msg.sender, // operator
                address(0), // from
                account, // to
                depositId, // depositID
                amount // token amount
            );
        }
        emit AddDeposit(account, token, stem, amount, bdv);
    }

    //////////////////////// REMOVE DEPOSIT ////////////////////////

    /**
     * @dev Remove `amount` of `token` from a user's Deposit in `stem`.
     *
     * A "Crate" refers to the existing Deposit in storage at:
     *  `s.a[account].deposits[token][stem]`
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
        int96 stem,
        uint256 amount
    ) internal returns (uint256 crateBDV) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 depositId = LibBytes.packAddressAndStem(token, stem);

        uint256 crateAmount = s.a[account].deposits[depositId].amount;
        crateBDV = s.a[account].deposits[depositId].bdv;
        // if amount is > crateAmount, check if user has a legacy deposit:
        if (amount > crateAmount) { 
            // get the absolute stem value.
            uint256 absStem = stem > 0 ? uint256(stem) : uint256(-stem);
            // only stems with modulo 1e6 can have a legacy deposit.
            if (absStem.mod(1e6) == 0) {
                (crateAmount, crateBDV) = migrateLegacyStemDeposit(
                    account,
                    token,
                    stem,
                    crateAmount,
                    crateBDV
                );
            }
        }
        require(amount <= crateAmount, "Silo: Crate balance too low.");

        // Partial remove
        if (amount < crateAmount) {
            // round up removal of BDV. (x - 1)/y + 1
            // https://stackoverflow.com/questions/17944
            uint256 removedBDV = amount.sub(1).mul(crateBDV).div(crateAmount).add(1);
            uint256 updatedBDV = crateBDV.sub(removedBDV);
            uint256 updatedAmount = crateAmount.sub(amount);

            // SafeCast unnecessary b/c updatedAmount <= crateAmount and updatedBDV <= crateBDV, 
            // which are both <= type(uint128).max
            s.a[account].deposits[depositId].amount = uint128(updatedAmount);
            s.a[account].deposits[depositId].bdv = uint128(updatedBDV);
            
            s.a[account].mowStatuses[token].bdv = s.a[account].mowStatuses[token].bdv.sub(
                uint128(removedBDV)
            );

            return removedBDV;
        }
        // Full remove
        if (crateAmount > 0) delete s.a[account].deposits[depositId];

        // SafeMath unnecessary b/c crateBDV <= type(uint128).max
        s.a[account].mowStatuses[token].bdv = s.a[account].mowStatuses[token].bdv.sub(
            uint128(crateBDV)
        );
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @dev Calculate the BDV ("Bean Denominated Value") for `amount` of `token`.
     *
     * Makes a call to a BDV function defined in the SiloSettings for this
     * `token`. See {AppStorage.sol:Storage-SiloSettings} for more information.
     */
    function beanDenominatedValue(
        address token,
        uint256 amount
    ) internal view returns (uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(s.ss[token].selector != bytes4(0), "Silo: Token not whitelisted");

        (bool success, bytes memory data) = address(this).staticcall(
            encodeBdvFunction(token, s.ss[token].encodeType, s.ss[token].selector, amount)
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

    function encodeBdvFunction(
        address token,
        bytes1 encodeType,
        bytes4 selector,
        uint256 amount
    ) internal pure returns (bytes memory callData) {
        if (encodeType == 0x00) {
            callData = abi.encodeWithSelector(selector, amount);
        } else if (encodeType == 0x01) {
            callData = abi.encodeWithSelector(selector, token, amount);
        } else {
            revert("Silo: Invalid encodeType");
        }
    }

    /**
     * @dev Locate the `amount` and `bdv` for a user's Deposit in storage.
     *
     * Silo V3 Deposits are stored within each {Account} as a mapping of:
     *  `uint256 DepositID => { uint128 amount, uint128 bdv }`
     *  The DepositID is the concatination of the token address and the stem.
     *
     * Silo V2 deposits are only usable after a successful migration, see
     * mowAndMigrate within the Migration facet.
     *
     */
    function getDeposit(
        address account,
        address token,
        int96 stem
    ) internal view returns (uint256 amount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 depositId = LibBytes.packAddressAndStem(token, stem);
        amount = s.a[account].deposits[depositId].amount;
        bdv = s.a[account].deposits[depositId].bdv;
    }

    /**
     * @dev Get the number of Stalk per BDV per Season for a whitelisted token.
     * 6 decimal precision: 1e10 units = 1 stalk per season
     */
    function stalkEarnedPerSeason(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalkEarnedPerSeason);
    }

    /**
     * @dev Get the number of Stalk per BDV for a whitelisted token. Formerly just stalk.
     */
    function stalkIssuedPerBdv(address token) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return uint256(s.ss[token].stalkIssuedPerBdv);
    }

    /**
     * @dev returns the cumulative stalk per BDV (stemTip) for a whitelisted token.
     */
    function stemTipForToken(
        address token
    ) internal view returns (int96 _stemTip) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // SafeCast unnecessary because all casted variables are types smaller that int96.
        _stemTip =
            s.ss[token].milestoneStem +
            int96(s.ss[token].stalkEarnedPerSeason).mul(
                int96(s.season.current).sub(int96(s.ss[token].milestoneSeason))
            );
    }

    /**
     * @dev returns the amount of grown stalk a deposit has earned.
     */
    function grownStalkForDeposit(
        address account,
        address token,
        int96 stem
    ) internal view returns (uint grownStalk) {
        // stemTipForToken(token) > depositGrownStalkPerBdv for all valid Deposits
        int96 _stemTip = stemTipForToken(token);
        require(stem <= _stemTip, "Silo: Invalid Deposit");
        // The check in the above line guarantees that subtraction result is positive
        // and thus the cast to `uint256` is safe.
        uint deltaStemTip = uint256(_stemTip.sub(stem));
        // no stalk has grown if the stem is equal to the stemTip.
        if (deltaStemTip == 0) return 0;
        (, uint bdv) = getDeposit(account, token, stem);

        grownStalk = deltaStemTip.mul(bdv).div(PRECISION);
    }

    /**
     * @dev returns the amount of grown stalk a deposit would have, based on the stem of the deposit.
     */
    function calculateStalkFromStemAndBdv(
        address token,
        int96 grownStalkIndexOfDeposit,
        uint256 bdv
    ) internal view returns (int96 grownStalk) {
        // current latest grown stalk index
        int96 _stemTipForToken = stemTipForToken(address(token));

        return _stemTipForToken.sub(grownStalkIndexOfDeposit).mul(toInt96(bdv));
    }

    /**
     * @notice returns the grown stalk and germination state of a deposit,
     * based on the amount of grown stalk it has earned.
     */
    function calculateStemForTokenFromGrownStalk(
        address token,
        uint256 grownStalk,
        uint256 bdv
    ) internal view returns (int96 stem, LibGerminate.Germinate germ) {
        LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);
        stem = germStem.stemTip.sub(toInt96(grownStalk.mul(PRECISION).div(bdv)));
        germ = LibGerminate._getGerminationState(stem, germStem);
    }

    /**
     * @dev returns the amount of grown stalk a deposit would have, based on the stem of the deposit.
     * Similar to calculateStalkFromStemAndBdv, but has an additional check to prevent division by 0.
     */
    function grownStalkAndBdvToStem(
        address token,
        uint256 grownStalk,
        uint256 bdv
    ) internal view returns (int96 cumulativeGrownStalk) {
        // first get current latest grown stalk index
        int96 _stemTipForToken = stemTipForToken(token);
        // then calculate how much stalk each individual bdv has grown
        // there's a > 0 check here, because if you have a small amount of unripe bean deposit, the bdv could
        // end up rounding to zero, then you get a divide by zero error and can't migrate without losing that deposit

        // prevent divide by zero error
        int96 grownStalkPerBdv = bdv > 0 ? toInt96(grownStalk.mul(PRECISION).div(bdv)) : 0;

        // subtract from the current latest index, so we get the index the deposit should have happened at
        return _stemTipForToken.sub(grownStalkPerBdv);
    }

    /**
     * @notice internal logic for migrating a legacy deposit.
     * @dev 
     */
    function migrateLegacyStemDeposit(
        address account, 
        address token,
        int96 newStem,
        uint256 crateAmount,
        uint256 crateBdv
    ) internal returns (uint256, uint256) { 
        AppStorage storage s = LibAppStorage.diamondStorage();
        // divide the newStem by 1e6 to get the legacy stem.
        uint256 legacyDepositId = LibBytes.packAddressAndStem(token, newStem.div(1e6));
        uint256 legacyAmount = s.a[account].legacyV3Deposits[legacyDepositId].amount;
        uint256 legacyBdv = s.a[account].legacyV3Deposits[legacyDepositId].bdv;
        crateAmount = crateAmount.add(legacyAmount);
        crateBdv = crateBdv.add(legacyBdv);
        delete s.a[account].legacyV3Deposits[legacyDepositId];

        // Emit burn events.
        emit TransferSingle(
            msg.sender,
            account,
            address(0),
            legacyDepositId,
            legacyAmount
        );

        emit RemoveDeposit(
            account,
            token,
            newStem.div(1e6),
            legacyAmount,
            legacyBdv
        );

        // Emit mint events.
        emit TransferSingle(
            msg.sender,
            address(0),
            account,
            LibBytes.packAddressAndStem(token, newStem),
            legacyAmount
        );

        emit AddDeposit(
            account,
            token,
            newStem,
            legacyAmount,
            legacyBdv
        );

        return (crateAmount, crateBdv);
    }

    function toInt96(uint256 value) internal pure returns (int96) {
        require(value <= uint256(type(int96).max), "SafeCast: value doesn't fit in an int96");
        return int96(value);
    }
}
