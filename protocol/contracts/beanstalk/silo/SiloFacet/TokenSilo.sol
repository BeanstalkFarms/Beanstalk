/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma abicoder v2;

import "./Silo.sol";

/**
 * @title TokenSilo
 * @author Publius, Brean, Pizzaman1337
 * @notice This contract contains functions for depositing, withdrawing and
 * claiming whitelisted Silo tokens.
 *
 * "Removing a Deposit" only removes from the `account`; the total amount
 * deposited in the Silo is decremented during withdrawal, _after_ a Withdrawal
 * is created. See "Finish Removal".
 */
contract TokenSilo is Silo {
    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted when `account` adds a single Deposit to the Silo.
     *
     * There is no "AddDeposits" event because there is currently no operation in which Beanstalk
     * creates multiple Deposits in different stems:
     *
     *  - `deposit()` always places the user's deposit in the current season.
     *  - `convert()` collapses multiple deposits into a single Season to prevent loss of Stalk.
     *
     * @param account The account that added a Deposit.
     * @param token Address of the whitelisted ERC20 token that was deposited.
     * @param stem The stem index that this `amount` was added to.
     * @param amount Amount of `token` added to `stem`.
     * @param bdv The BDV associated with `amount` of `token` at the time of Deposit.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice Emitted when `account` removes a single Deposit from the Silo.
     *
     * Occurs during `withdraw()` and `convert()` operations.
     *
     * @param account The account that removed a Deposit.
     * @param token Address of the whitelisted ERC20 token that was removed.
     * @param stem The stem that this `amount` was removed from.
     * @param amount Amount of `token` removed from `stem`.
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice Emitted when `account` removes multiple Deposits from the Silo.
     * Occurs during `withdraw()` and `convert()` operations.
     * Gas optimization: emit 1 `RemoveDeposits` instead of N `RemoveDeposit` events.
     *
     * @param account The account that removed Deposits.
     * @param token Address of the whitelisted ERC20 token that was removed.
     * @param stems stems of Deposit to remove from.
     * @param amounts Amounts of `token` to remove from corresponding `stems`.
     * @param amount Sum of `amounts`.
     */
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    // ERC1155 events

    /**
     * @notice Emitted when a Deposit is created, removed, or transferred.
     *
     * @param operator the address that performed the operation.
     * @param from the address the Deposit is being transferred from.
     * @param to the address the Deposit is being transferred to.
     * @param id the depositID of the Deposit.
     * @param value the amount of the Deposit.
     */
    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );

    /**
     * @notice Emitted when multiple deposits are withdrawn or transferred.
     *
     * @dev This event is emitted in `convert()`
     *
     * @param operator the address that performed the operation.
     * @param from the address the Deposit is being transferred from.
     * @param to the address the Deposit is being transferred to.
     * @param ids the depositIDs of the Deposit.
     * @param values the amounts of the Deposit.
     */
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );

    //////////////////////// DEPOSIT ////////////////////////

    /**
     * @dev Handle deposit accounting.
     *
     * - {LibTokenSilo.deposit} calculates BDV, adds a Deposit to `account`, and
     *   increments the total amount Deposited.
     * - {LibSilo.mintStalk} mints the Stalk associated with
     *   the Deposit.
     *
     * This step should enforce that new Deposits are placed into the current
     * `LibTokenSilo.stemTipForToken(token)`.
     */
    function _deposit(
        address account,
        address token,
        uint256 amount
    ) internal returns (uint256 stalk, int96 stem) {
        LibGerminate.Germinate germ;
        (stalk, germ) = LibTokenSilo.deposit(
            account,
            token,
            stem = LibTokenSilo.stemTipForToken(token),
            amount
        );
        LibSilo.mintGerminatingStalk(account, uint128(stalk), germ);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /**
     * @notice Handles withdraw accounting.
     *
     * - {LibSilo._removeDepositFromAccount} calculates the stalk
     * assoicated with a given deposit, and removes the deposit from the account.
     * emits `RemoveDeposit` and `TransferSingle` events.
     *
     * - {_withdraw} updates the total value deposited in the silo, and burns
     * the stalk assoicated with the deposits.
     *
     */
    function _withdrawDeposit(address account, address token, int96 stem, uint256 amount) internal {
        // Remove the Deposit from `account`.
        (
            uint256 initalStalkRemoved, 
            uint256 grownStalkRemoved, 
            uint256 bdvRemoved, 
            LibGerminate.Germinate germinate
        ) = LibSilo._removeDepositFromAccount(
                account,
                token,
                stem,
                amount,
                LibTokenSilo.Transfer.emitTransferSingle
            );
        if (germinate == LibGerminate.Germinate.NOT_GERMINATING) {
            // remove the deposit from totals
            _withdraw(account, token, amount, bdvRemoved, initalStalkRemoved.add(grownStalkRemoved));
        } else {
            // remove deposit from germination, and burn the grown stalk.
            // grown stalk does not germinate and is not counted in germinating totals.
            _withdrawGerminating(
                account,
                token,
                amount,
                bdvRemoved,
                initalStalkRemoved,
                germinate
            );

            if (grownStalkRemoved > 0) {
                LibSilo.burnActiveStalk(
                    account, 
                    grownStalkRemoved
                ); 
            }
        }
    }

    /**
     * @notice Handles withdraw accounting for multiple deposits.
     *
     * - {LibSilo._removeDepositsFromAccount} removes the deposits from the account,
     * and returns the total tokens, stalk, and bdv removed from the account.
     *
     * - {_withdraw} updates the total value deposited in the silo, and burns
     * the stalk assoicated with the deposits.
     *
     */
    function _withdrawDeposits(
        address account,
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) internal returns (uint256) {
        require(stems.length == amounts.length, "Silo: Crates, amounts are diff lengths.");

        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(
            account,
            token,
            stems,
            amounts
        );

        // withdraw deposits that are not germinating.
        if (ar.active.tokens > 0) {
            _withdraw(account, token, ar.active.tokens, ar.active.bdv, ar.active.stalk);
        }
       
        // withdraw Germinating deposits from odd seasons
        if (ar.odd.tokens > 0) {
            _withdrawGerminating(
                account,
                token,
                ar.odd.tokens,
                ar.odd.bdv,
                ar.odd.stalk,
                LibGerminate.Germinate.ODD
            );
        }

        // withdraw Germinating deposits from even seasons
        if (ar.even.tokens > 0) {
            _withdrawGerminating(
                account,
                token,
                ar.even.tokens,
                ar.even.bdv,
                ar.even.stalk,
                LibGerminate.Germinate.EVEN
            );
        }

        if (ar.grownStalkFromGermDeposits > 0) {
            LibSilo.burnActiveStalk(
                account, 
                ar.grownStalkFromGermDeposits
            ); 
        }

        // we return the summation of all tokens removed from the silo.
        // to be used in {SiloFacet.withdrawDeposits}.
        return ar.active.tokens.add(ar.odd.tokens).add(ar.even.tokens);
    }

    /**
     * @dev internal helper function for withdraw accounting.
     */
    function _withdraw(
        address account,
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 stalk
    ) private {
        // Decrement total deposited in the silo.
        LibTokenSilo.decrementTotalDeposited(token, amount, bdv);
        // Burn stalk and roots associated with the stalk.
        LibSilo.burnActiveStalk(account, stalk); 
    }

    /**
     * @dev internal helper function for withdraw accounting with germination.
     * @param germinateState determines whether to withdraw from odd or even germination.
     */
    function _withdrawGerminating(
        address account,
        address token,
        uint256 amount,
        uint256 bdv,
        uint256 stalk,
        LibGerminate.Germinate germinateState
    ) private {
        // Decrement from total germinating.
        LibTokenSilo.decrementTotalGerminating(token, amount, bdv, germinateState); // Decrement total Germinating in the silo.
        LibSilo.burnGerminatingStalk(account, uint128(stalk), germinateState); // Burn stalk and roots associated with the stalk.
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @notice Intenral transfer logic accounting.
     *
     * @dev Removes `amount` of a single Deposit from `sender` and transfers
     * it to `recipient`. No Stalk are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change.
     */
    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        int96 stem,
        uint256 amount
    ) internal returns (uint256) {
        (
            uint256 initalStalk,
            uint256 grownStalk,
            uint256 bdv,
            LibGerminate.Germinate germ
        ) = LibSilo._removeDepositFromAccount(
                sender,
                token,
                stem,
                amount,
                LibTokenSilo.Transfer.noEmitTransferSingle
            );
        LibTokenSilo.addDepositToAccount(
            recipient,
            token,
            stem,
            amount,
            bdv,
            LibTokenSilo.Transfer.noEmitTransferSingle
        );

        if (germ == LibGerminate.Germinate.NOT_GERMINATING) {
            LibSilo.transferStalk(sender, recipient, initalStalk.add(grownStalk));
        } else {
            LibSilo.transferGerminatingStalk(sender, recipient, initalStalk, germ);
            if (grownStalk > 0) {
                LibSilo.transferStalk(
                    sender,
                    recipient, 
                    grownStalk
                ); 
            }
        }

        /**
         * the current beanstalk system uses {AddDeposit}
         * and {RemoveDeposit} events to represent a transfer.
         * However, the ERC1155 standard has a dedicated {TransferSingle} event,
         * which is used here.
         */
        emit TransferSingle(
            msg.sender,
            sender,
            recipient,
            LibBytes.packAddressAndStem(token, stem),
            amount
        );

        return bdv;
    }

    /**
     * @notice Intenral transfer logic accounting for multiple deposits.
     *
     * @dev Removes `amounts` of multiple Deposits from `sender` and transfers
     * them to `recipient`. No Stalk are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change.
     */
    function _transferDeposits(
        address sender,
        address recipient,
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) internal returns (uint256[] memory) {
        require(stems.length == amounts.length, "Silo: Crates, amounts are diff lengths.");

        LibSilo.AssetsRemoved memory ar;
        uint256[] memory bdvs = new uint256[](stems.length);
        uint256[] memory removedDepositIDs = new uint256[](stems.length);

        // get the germinating stem for the token
        LibGerminate.GermStem memory germStem = LibGerminate.getGerminatingStem(token);
        // Similar to {removeDepositsFromAccount}, however the Deposit is also
        // added to the recipient's account during each iteration.
        for (uint256 i; i < stems.length; ++i) {
            LibGerminate.Germinate germ = LibGerminate._getGerminationState(
                stems[i],
                germStem
            );
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                sender,
                token,
                stems[i],
                amounts[i]
            );
            LibTokenSilo.addDepositToAccount(
                recipient,
                token,
                stems[i],
                amounts[i],
                crateBdv,
                LibTokenSilo.Transfer.noEmitTransferSingle
            );
            uint256 crateStalk = LibSilo.stalkReward(
                stems[i],
                germStem.stemTip,
                crateBdv.toUint128()
            );

            // if the deposit is germinating, increment germinating bdv and stalk,
            // otherwise increment deposited values.
            ar.active.tokens = ar.active.tokens.add(amounts[i]);
            if (germ == LibGerminate.Germinate.NOT_GERMINATING) {
                ar.active.bdv = ar.active.bdv.add(crateBdv);
                ar.active.stalk = ar.active.stalk.add(crateStalk);
            } else {
                if (germ == LibGerminate.Germinate.ODD) {
                    ar.odd.bdv = ar.odd.bdv.add(crateBdv);
                    ar.odd.stalk = ar.odd.stalk.add(crateStalk);
                } else {
                    ar.even.bdv = ar.even.bdv.add(crateBdv);
                    ar.even.stalk = ar.even.stalk.add(crateStalk);
                }
            }
            bdvs[i] = crateBdv;
            removedDepositIDs[i] = uint256(LibBytes.packAddressAndStem(token, stems[i]));
        }

        // transfer regular and germinating stalk (if appliable)
        LibSilo.transferStalkAndGerminatingStalk(sender, recipient, token, ar);

        /**
         *  The current beanstalk system uses a mix of {AddDeposit}
         *  and {RemoveDeposits} events to represent a batch transfer.
         *  However, the ERC1155 standard has a dedicated {batchTransfer} event,
         *  which is used here.
         */
        emit LibSilo.TransferBatch(msg.sender, sender, recipient, removedDepositIDs, amounts);
        // emit RemoveDeposits event (tokens removed are summation).
        emit RemoveDeposits(
            sender,
            token,
            stems, 
            amounts,
            ar.active.tokens, 
            bdvs
        );

        return bdvs;
    }

}
