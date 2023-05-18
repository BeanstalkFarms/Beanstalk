/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Silo.sol";

/**
 * @title TokenSilo
 * @author Publius, Brean
 * @notice This contract contains functions for depositing, withdrawing and 
 * claiming whitelisted Silo tokens.
 *
 *
 * - LibTokenSilo offers `incrementTotalDeposited` and `decrementTotalDeposited`
 *   but these operations are performed directly for withdrawals.
 * - "Removing a Deposit" only removes from the `account`; the total amount
 *   deposited in the Silo is decremented during withdrawal, _after_ a Withdrawal
 *   is created. See "Finish Removal".
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
     *  - `deposit()` always places the user's deposit in the current `_season()`.
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
    ); //add bdv[] here? in favor of array
    
    // per the zero withdraw update, there is no claiming function for withdraws.abi
    // events are kept for backwards compatibility
    event RemoveWithdrawals(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256 amount
    );
    
    event RemoveWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
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
    ) internal returns (uint256 stalk, int96 stem){
        stalk = LibTokenSilo.deposit(
            account,
            token,
            stem = LibTokenSilo.stemTipForToken(token),
            amount
        );
        LibSilo.mintStalk(account, stalk);
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
    function _withdrawDeposit(
        address account,
        address token,
        int96 stem,
        uint256 amount
    ) internal {
        // Remove the Deposit from `account`.
        (uint256 stalkRemoved, uint256 bdvRemoved) = LibSilo._removeDepositFromAccount(
            account,
            address(token),
            stem,
            amount,
            LibTokenSilo.Transfer.emitTransferSingle
        );
        
        _withdraw(
            account,
            address(token),
            amount,
            bdvRemoved,
            stalkRemoved
        );
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
        require(
            stems.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(
            account,
            token,
            stems,
            amounts
        );

        _withdraw(
            account,
            token,
            ar.tokensRemoved,
            ar.bdvRemoved,
            ar.stalkRemoved
        );

        // we return the total tokens removed from the deposits,
        // to be used in {SiloFacet.withdrawDeposits}.
        return ar.tokensRemoved;
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
        LibTokenSilo.decrementTotalDeposited(token, amount, bdv); // Decrement total Deposited in the silo.
        LibSilo.burnStalk(account, stalk); // Burn stalk and roots associated with the stalk.
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
        (uint256 stalk, uint256 bdv) = LibSilo._removeDepositFromAccount(
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
        LibSilo.transferStalk(sender, recipient, stalk);

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
        require(
            stems.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        LibSilo.AssetsRemoved memory ar;
        uint256[] memory bdvs = new uint256[](stems.length);
        uint256[] memory removedDepositIDs = new uint256[](stems.length);

        // Similar to {removeDepositsFromAccount}, however the Deposit is also 
        // added to the recipient's account during each iteration.
        for (uint256 i; i < stems.length; ++i) {
            uint256 depositID = uint256(LibBytes.packAddressAndStem(token, stems[i]));
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
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    stems[i],
                    LibTokenSilo.stemTipForToken(token),
                    crateBdv.toUint128()
                )
            );
            bdvs[i] = crateBdv;
            removedDepositIDs[i] = depositID;

        }

        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv)
        );

        /** 
         *  The current beanstalk system uses a mix of {AddDeposit}
         *  and {RemoveDeposits} events to represent a batch transfer.
         *  However, the ERC1155 standard has a dedicated {batchTransfer} event,
         *  which is used here.
         */
        emit LibSilo.TransferBatch(msg.sender, sender, recipient, removedDepositIDs, amounts);
        emit RemoveDeposits(sender, token, stems, amounts, ar.tokensRemoved, bdvs);

        LibSilo.transferStalk(
            sender,
            recipient,
            ar.stalkRemoved
        );

        return bdvs;
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice Find the amount and BDV of `token` that `account` has Deposited in stem index `stem`.
     * 
     * Returns a deposit tuple `(uint256 amount, uint256 bdv)`.
     *
     * @return amount The number of tokens contained in this Deposit.
     * @return bdv The BDV associated with this Deposit. See {FIXME(doc)}.
     */
    function getDeposit(
        address account,
        address token,
        int96 stem
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, stem);
    }

    /**
     * @notice Get the total amount of `token` currently Deposited in the Silo across all users.
     */
    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
    }

    /**
     * @notice Get the total bdv of `token` currently Deposited in the Silo across all users.
     */
    function getTotalDepositedBdv(address token) external view returns (uint256) {
        return s.siloBalances[token].depositedBdv;
    }

    /**
     * @notice Get the Storage.SiloSettings for a whitelisted Silo token.
     *
     * Contains:
     *  - the BDV function selector
     *  - Stalk per BDV
     *  - stalkEarnedPerSeason
     *  - milestoneSeason
     *  - lastStem
     */
    function tokenSettings(address token)
        external
        view
        returns (Storage.SiloSettings memory)
    {
        return s.ss[token];
    }

    //////////////////////// ERC1155 ////////////////////////

    /**
     * @notice returns the amount of tokens in a Deposit.
     * 
     * @dev see {getDeposit} for both the bdv and amount.
     */
    function balanceOf(
        address account, 
        uint256 depositId
    ) external view returns (uint256 amount) {
        return s.a[account].deposits[depositId].amount;
    }

    /**
     * @notice returns an array of amounts corresponding to Deposits.
     */
    function balanceOfBatch(
        address[] calldata accounts, 
        uint256[] calldata depositIds
    ) external view returns (uint256[] memory) {
        require(
            accounts.length == depositIds.length, 
            "ERC1155: ids and amounts length mismatch"
        );
        uint256[] memory balances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            balances[i] = s.a[accounts[i]].deposits[depositIds[i]].amount;
        }
        return balances;
    }

    /**
     * @notice outputs the depositID given an token address and stem.
     */
    function getDepositId(
        address token, 
        int96 stem
    ) external pure returns (uint256) {
        return LibBytes.packAddressAndStem(token, stem);
    }
}
