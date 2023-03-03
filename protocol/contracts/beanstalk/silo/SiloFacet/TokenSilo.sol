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
 * @dev WONTFIX: There is asymmetry in the structure of deposit / withdrawal functions.
 * Since the withdraw + claim step is being removed in Silo V3 in the coming
 * months, we'll leave these asymmetries present for now.
 *
 * - LibTokenSilo offers `incrementTotalDeposited` and `decrementTotalDeposited`
 *   but these operations are performed directly for withdrawals.
 * - "Removing a Deposit" only removes from the `account`; the total amount
 *   deposited in the Silo is decremented during withdrawal, _after_ a Withdrawal
 *   is created. See "Finish Removal".
 */
contract TokenSilo is Silo {
    uint32 private constant ASSET_PADDING = 100;

    using SafeMath for uint256;
    using SafeCast for uint256;
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted when `account` adds a single Deposit to the Silo.
     *
     * There is no "AddDeposits" event because there is currently no operation in which Beanstalk
     * creates multiple Deposits in different grownStalkPerBdvs:
     *
     *  - `deposit()` always places the user's deposit in the current `_season()`.
     *  - `convert()` collapses multiple deposits into a single Season to prevent loss of Stalk.
     *
     * @param account The account that added a Deposit.
     * @param token Address of the whitelisted ERC20 token that was deposited.
     * @param grownStalkPerBdv The grownStalkPerBdv index that this `amount` was added to.
     * @param amount Amount of `token` added to `grownStalkPerBdv`.
     * @param bdv The BDV associated with `amount` of `token` at the time of Deposit.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        int128 grownStalkPerBdv,
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
     * @param grownStalkPerBdv The grownStalkPerBdv that this `amount` was removed from.
     * @param amount Amount of `token` removed from `grownStalkPerBdv`.
     * //add bdv here?
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int128 grownStalkPerBdv,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice Emitted when `account` removes multiple Deposits from the Silo.
     *
     * Occurs during `withdraw()` and `convert()` operations. 
     *
     * Gas optimization: emit 1 `RemoveDeposits` instead of N `RemoveDeposit` events.
     *
     * @param account The account that removed Deposits.
     * @param token Address of the whitelisted ERC20 token that was removed.
     * @param grownStalkPerBdvs grownStalkPerBdvs of Deposit to remove from.
     * @param amounts Amounts of `token` to remove from corresponding `grownStalkPerBdvs`.
     * @param amount Sum of `amounts`.
     */
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int128[] grownStalkPerBdvs,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    ); //add bdv[] here? in favor of array

    // note add/remove withdrawal(s) are removed as claiming is removed
    // FIXME: to discuss with subgraph team to update

    /**
     */
    event DepositApproval(
        address indexed owner,
        address indexed spender,
        address token,
        uint256 amount
    );

    //////////////////////// UTILITIES ////////////////////////

    /**
     * @dev Convenience struct to simplify return value of {TokenSilo._withdrawDeposits()}.
     *
     * FIXME(naming): `tokensRemoved` -> `amountsRemoved`.
     */
    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice Find the amount and BDV of `token` that `account` has Deposited in grownStalkPerBdv `grownStalkPerBdv`.
     * 
     * Returns a deposit tuple `(uint256 amount, uint256 bdv)`.
     *
     * @return amount The number of tokens contained in this Deposit.
     * @return bdv The BDV associated with this Deposit. See {FIXME(doc)}.
     */
    function getDeposit(
        address account,
        address token,
        int128 grownStalkPerBdv
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, grownStalkPerBdv);
    }

    /**
     * @notice Get the total amount of `token` currently Deposited in the Silo across all users.
     */
    function getTotalDeposited(address token) external view returns (uint256) {
        return s.siloBalances[token].deposited;
    }

    /**
     * @notice Get the total amount of `token` currently Withdrawn from the Silo across all users.
     */
    function getTotalWithdrawn(address token) external view returns (uint256) {
        return s.siloBalances[token].withdrawn;
    }

    /**
     * @notice Get the Storage.SiloSettings for a whitelisted Silo token.
     *
     * Contains:
     *  - the BDV function selector
     *  - Stalk per BDV
     *  - stalkEarnedPerSeason
     *  - lastUpdateSeason
     *  - lastCumulativeGrownStalkPerBdv
     * 
     * @dev FIXME(naming) getTokenSettings ?
     */
    function tokenSettings(address token)
        external
        view
        returns (Storage.SiloSettings memory)
    {
        return s.ss[token];
    }

    /**
     * @notice Returns how much of a `token` Deposit that `spender` can transfer on behalf of `owner`.
     * @param owner The account that has given `spender` approval to transfer Deposits. 
     * @param spender The address (contract or EOA) that is allowed to transfer Deposits on behalf of `owner`.
     * @param token Whitelisted ERC20 token.
     */
    function depositAllowance(
        address owner,
        address spender,
        address token
    ) public view virtual returns (uint256) {
        return s.a[owner].depositAllowances[spender][token];
    }

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
     * `LibTokenSilo.cumulativeGrownStalkPerBdv(token)`.
     */
    function _depositERC20(
        address account,
        IERC20 token,
        uint256 amount
    ) internal {
        console.log('_deposit: ', amount);
        (uint256 stalk) = LibTokenSilo.deposit(
            account,
            address(token),
            LibTokenSilo.cumulativeGrownStalkPerBdv(token), // TODO: may need to generalize this for all standards, just not ERC20
            amount
        );
        console.log('_deposit now mint stalk: ', stalk);
        LibSilo.mintStalk(account, stalk);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /**
     * @dev Remove a single Deposit and create a single Withdrawal with its contents.
     */
    function _withdrawDeposit(
        address account,
        IERC20 token,
        int96 grownStalkPerBdv,
        uint256 amount
    ) internal {
        // Remove the Deposit from `account`.
        (uint256 stalkRemoved, ) = removeDepositFromAccount(
            account,
            token,
            grownStalkPerBdv,
            amount
        );
        console.log('_withdrawDeposit stalkRemoved: ', stalkRemoved);
        // Add a Withdrawal, update totals, burn Stalk.
        _withdraw(
            account,
            token,
            amount,
            stalkRemoved
        );
    }

    /**
     * @dev Remove multiple Deposits and create a single Withdrawal with the
     * sum of their contents.
     *
     * Requirements:
     * - Each item in `grownStalkPerBdvs` must have a corresponding item in `amounts`.
     */
    function _withdrawDeposits(
        address account,
        address token,
        int128[] calldata grownStalkPerBdvs,
        uint256[] calldata amounts
    ) internal returns (uint256) {
        require(
            grownStalkPerBdvs.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        // Remove the Deposits from `account`.
        AssetsRemoved memory ar = removeDepositsFromAccount(
            account,
            token,
            grownStalkPerBdvs,
            amounts
        );

        // Add a Withdrawal, update totals, burn Stalk.
        _withdraw(
            account,
            token,
            ar.tokensRemoved,
            ar.stalkRemoved
        );
        /** @dev we return ar.tokensremoved here, but not in _withdrawDeposit()
         *  to use in siloFacet.withdrawDeposits()
         */ 

        return ar.tokensRemoved;
    }

    /**
     * @dev Create a Withdrawal.
     *
     * Gas optimization: Completion of the Remove step (decrementing total
     * Deposited and burning Stalk) is performed here because there 
     */
    function _withdraw(
        address account,
        address token,
        uint256 amount,
        uint256 stalk
    ) private {
        LibTokenSilo.decrementTotalDeposited(token, amount); // Decrement total Deposited
        console.log('_withdraw amount: ', amount);
        console.log('_withdraw stalk: ', stalk);
        LibSilo.burnStalk(account, stalk); // Burn Stalk
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
    // TODO: rename should this be generalized?
    function removeDepositFromAccount(
        address account,
        address token,
        int96 grownStalkPerBdv,
        uint256 amount
    )
        private
        returns (
            uint256 stalkRemoved,
            uint256 bdvRemoved
        )
    {
        bytes32 depositData
        bdvRemoved = LibTokenSilo.removeDepositFromAccount(account, token, grownStalkPerBdv, amount);
        console.log('s.ss[token].stalk: ', s.ss[token].stalkIssuedPerBdv);
        console.log('bdvRemoved.mul(s.ss[token].stalk: ', bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv));
        console.log('removeDepositFromAccount grownStalkPerBdv: ');
        console.logInt(grownStalkPerBdv);

        console.log('removeDepositFromAccount cumulativeGrownStalkPerBdv: ');
        console.logInt(LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)));
        console.log('removeDepositFromAccount bdvRemoved: ', bdvRemoved);

        uint256 stalkReward = LibSilo.stalkReward(
                grownStalkPerBdv, //this is the index of when it was deposited
                LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)), //this is latest for this token
                bdvRemoved.toUint128()
            );
        console.log('removeDepositFromAccount stalkReward: ', stalkReward);


        //need to get amount of stalk earned by this deposit (index of now minus index of when deposited)
        stalkRemoved = bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(
                grownStalkPerBdv, //this is the index of when it was deposited
                LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)), //this is latest for this token
                bdvRemoved.toUint128()
            )
        );
        console.log('removeDepositFromAccount stalkRemoved: ', stalkRemoved);
        // event TransferSingle(address indexed _operator, address indexed _from, address indexed _to, uint256 _id, uint256 _value);
        // TODO: finalize event stuff
        emit TransferSingle(msg.sender, account, address(0), depositData, amount);
        emit RemoveDeposit(account, token, grownStalkPerBdv, amount, bdvRemoved);
    }

    /**
     * @dev Removes from multiple Deposits, emits the RemoveDeposits
     * event, and returns the Stalk/BDV that were removed.
     * 
     * Used in:
     * - {TokenSilo:_withdrawDeposits}
     * - {SiloFacet:enrootDeposits}
     */
    function removeDepositsFromAccount(
        address account,
        address token,
        int128[] calldata grownStalkPerBdvs,
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        console.log('removeDepositsFromAccount: ', account);
        //make bdv array and add here?
        uint256[] memory bdvsRemoved = new uint256[](grownStalkPerBdvs.length);
        for (uint256 i; i < grownStalkPerBdvs.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                account,
                token,
                grownStalkPerBdvs[i],
                amounts[i]
            );
            bdvsRemoved[i] = crateBdv;
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            console.log('s.ss[token].stalkIssuedPerBdv: ', s.ss[token].stalkIssuedPerBdv);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    grownStalkPerBdvs[i],
                    LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)),
                    crateBdv.toUint128()
                )
            );
            console.log('ar.stalkRemoved from: ', i, ar.stalkRemoved);
        }
        console.log('1 ar.stalkRemoved: ', ar.stalkRemoved);
        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv)
        );
        console.log('2 ar.stalkRemoved: ', ar.stalkRemoved);

        //need to add BDV array here
        emit RemoveDeposits(account, token, grownStalkPerBdvs, amounts, ar.tokensRemoved, bdvsRemoved);
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @dev Removes `amount` of a single Deposit from `sender` and transfers
     * it to `recipient`. No Stalk are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change. 
     */
    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        int128 grownStalkPerBdvs,
        uint256 amount
    ) internal returns (uint256) {
        (uint256 stalk, uint256 bdv) = removeDepositFromAccount(
            sender,
            token,
            grownStalkPerBdvs,
            amount
        );
        LibTokenSilo.addDepositToAccount(recipient, token, grownStalkPerBdvs, amount, bdv);
        LibSilo.transferStalk(sender, recipient, stalk);
        return bdv;
    }

    /**
     * @dev Removes `amounts` of multiple Deposits from `sender` and transfers
     * them to `recipient`. No Stalk are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change. 
     */
    function _transferDeposits(
        address sender,
        address recipient,
        address token,
        int128[] calldata grownStalkPerBdvs,
        uint256[] calldata amounts
    ) internal returns (uint256[] memory) {
        require(
            grownStalkPerBdvs.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        AssetsRemoved memory ar;
        uint256[] memory bdvs = new uint256[](grownStalkPerBdvs.length);

        // Similar to {removeDepositsFromAccount}, however the Deposit is also 
        // added to the recipient's account during each iteration.
        for (uint256 i; i < grownStalkPerBdvs.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                sender,
                token,
                grownStalkPerBdvs[i],
                amounts[i]
            );
            LibTokenSilo.addDepositToAccount(
                recipient,
                token,
                grownStalkPerBdvs[i],
                amounts[i],
                crateBdv
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    grownStalkPerBdvs[i],
                    LibTokenSilo.cumulativeGrownStalkPerBdv(IERC20(token)),
                    crateBdv.toUint128()
                )
            );
            bdvs[i] = crateBdv;
        }

        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalkIssuedPerBdv)
        );

        emit RemoveDeposits(sender, token, grownStalkPerBdvs, amounts, ar.tokensRemoved, bdvs);

        // Transfer all the Stalk
        LibSilo.transferStalk(
            sender,
            recipient,
            ar.stalkRemoved
        );

        return bdvs;
    }

    //////////////////////// APPROVE ////////////////////////

    function _spendDepositAllowance(
        address owner,
        address spender,
        address token,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = depositAllowance(owner, spender, token);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Silo: insufficient allowance");
            _approveDeposit(owner, spender, token, currentAllowance - amount);
        }
    }
        
    function _approveDeposit(address account, address spender, address token, uint256 amount) internal {
        s.a[account].depositAllowances[spender][token] = amount;
        emit DepositApproval(account, spender, token, amount);
    }
}
