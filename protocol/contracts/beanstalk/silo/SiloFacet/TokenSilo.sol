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
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted when `account` adds a single Deposit to the Silo.
     *
     * There is no "AddDeposits" event because there is currently no operation in which Beanstalk
     * creates multiple Deposits in different Seasons:
     *
     *  - `deposit()` always places the user's deposit in the current `_season()`.
     *  - `convert()` collapses multiple deposits into a single Season to prevent loss of Stalk.
     *
     * @param account The account that added a Deposit.
     * @param token Address of the whitelisted ERC20 token that was deposited.
     * @param season The Season that this `amount` was added to.
     * @param amount Amount of `token` added to `season`.
     * @param bdv The BDV associated with `amount` of `token` at the time of Deposit.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
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
     * @param season The Season that this `amount` was removed from.
     * @param amount Amount of `token` removed from `season`.
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
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
     * @param seasons Seasons of Deposit to remove from.
     * @param amounts Amounts of `token` to remove from corresponding `seasons`.
     * @param amount Sum of `amounts`.
     */
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256[] amounts,
        uint256 amount
    );


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
        uint256 seedsRemoved;
        uint256 bdvRemoved;
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice Find the amount and BDV of `token` that `account` has Deposited in Season `season`.
     * 
     * Returns a deposit tuple `(uint256 amount, uint256 bdv)`.
     *
     * @return amount The number of tokens contained in this Deposit.
     * @return bdv The BDV associated with this Deposit. See {FIXME(doc)}.
     */
    function getDeposit(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, season);
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
     *  - Seeds per BDV
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
     * - {LibSilo.mintSeedsAndStalk} mints the Stalk and Seeds associated with
     *   the Deposit.
     * 
     * This step should enforce that new Deposits are placed into the current 
     * `_season()`.
     */
    function _deposit(
        address account,
        address token,
        uint256 amount
    ) internal {
        (uint256 seeds, uint256 stalk) = LibTokenSilo.deposit(
            account,
            token,
            _season(),
            amount
        );
        LibSilo.mintSeedsAndStalk(account, seeds, stalk);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /**
     * @dev Remove a single Deposit and create a single Withdrawal with its contents.
     */
    function _withdrawDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal {
        // Remove the Deposit from `account`.
        (uint256 stalkRemoved, uint256 seedsRemoved, ) = removeDepositFromAccount(
            account,
            token,
            season,
            amount
        );

        // Add a Withdrawal, update totals, burn Stalk and Seeds.
        _withdraw(
            account,
            token,
            amount,
            stalkRemoved,
            seedsRemoved
        );
    }

    /**
     * @dev Remove multiple Deposits and create a single Withdrawal with the
     * sum of their contents.
     *
     * Requirements:
     * - Each item in `seasons` must have a corresponding item in `amounts`.
     */
    function _withdrawDeposits(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (uint256) {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        // Remove the Deposits from `account`.
        AssetsRemoved memory ar = removeDepositsFromAccount(
            account,
            token,
            seasons,
            amounts
        );

        // Add a Withdrawal, update totals, burn Stalk and Seeds.
        _withdraw(
            account,
            token,
            ar.tokensRemoved,
            ar.stalkRemoved,
            ar.seedsRemoved
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
     * Deposited and burning Seeds & Stalk) is performed here because there 
     */
    function _withdraw(
        address account,
        address token,
        uint256 amount,
        uint256 stalk,
        uint256 seeds
    ) private {
        LibTokenSilo.decrementTotalDeposited(token, amount); // Decrement total Deposited
        LibSilo.burnSeedsAndStalk(account, seeds, stalk); // Burn Seeds and Stalk
    }

    //////////////////////// CLAIM ///////////////////////// 

    // as of the zero withdraw update, claims are not used anymore. 
    // this functionality is kept for reverse functionality.
    function _claimWithdrawal(
        address account,
        address token,
        uint32 season
    ) internal returns (uint256) {
        uint256 amount = _removeTokenWithdrawal(account, token, season);
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawal(msg.sender, token, season, amount);
        return amount;
    }

    function _claimWithdrawals(
        address account,
        address token,
        uint32[] calldata seasons
    ) internal returns (uint256 amount) {
        for (uint256 i; i < seasons.length; ++i) {
            amount = amount.add(
                _removeTokenWithdrawal(account, token, seasons[i])
            );
        }
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.sub(
            amount
        );
        emit RemoveWithdrawals(msg.sender, token, seasons, amount);
        return amount;
    }



    //////////////////////// REMOVE ////////////////////////

    /**
     * @dev Removes from a single Deposit, emits the RemoveDeposit event,
     * and returns the Stalk/Seeds/BDV that were removed.
     *
     * Used in:
     * - {TokenSilo:_withdrawDeposit}
     * - {TokenSilo:_transferDeposit}
     */
    function removeDepositFromAccount(
        address account,
        address token,
        uint32 season,
        uint256 amount
    )
        private
        returns (
            uint256 stalkRemoved,
            uint256 seedsRemoved,
            uint256 bdvRemoved
        )
    {
        bdvRemoved = LibTokenSilo.removeDepositFromAccount(account, token, season, amount);

        seedsRemoved = bdvRemoved.mul(s.ss[token].seeds);
        stalkRemoved = bdvRemoved.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(
                seedsRemoved,
                _season() - season
            )
        );

        emit RemoveDeposit(account, token, season, amount);
    }

    /**
     * @dev Removes from multiple Deposits, emits the RemoveDeposits
     * event, and returns the Stalk/Seeds/BDV that were removed.
     * 
     * Used in:
     * - {TokenSilo:_withdrawDeposits}
     * - {SiloFacet:enrootDeposits}
     */
    function removeDepositsFromAccount(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        for (uint256 i; i < seasons.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                account,
                token,
                seasons[i],
                amounts[i]
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    crateBdv.mul(s.ss[token].seeds), // crateSeeds
                    _season() - seasons[i]
                )
            );
        }

        ar.seedsRemoved = ar.bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalk)
        );

        emit RemoveDeposits(account, token, seasons, amounts, ar.tokensRemoved);
    }

    //////////////////////// TRANSFER ////////////////////////

    /**
     * @dev Removes `amount` of a single Deposit from `sender` and transfers
     * it to `recipient`. No Stalk/Seeds are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change. 
     */
    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256) {
        (uint256 stalk, uint256 seeds, uint256 bdv) = removeDepositFromAccount(
            sender,
            token,
            season,
            amount
        );
        LibTokenSilo.addDepositToAccount(recipient, token, season, amount, bdv);
        LibSilo.transferSeedsAndStalk(sender, recipient, seeds, stalk);
        return bdv;
    }

    /**
     * @dev Removes `amounts` of multiple Deposits from `sender` and transfers
     * them to `recipient`. No Stalk/Seeds are burned, and the total amount of
     * Deposited `token` in the Silo doesn't change. 
     */
    function _transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (uint256[] memory) {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );

        AssetsRemoved memory ar;
        uint256[] memory bdvs = new uint256[](seasons.length);

        // Similar to {removeDepositsFromAccount}, however the Deposit is also 
        // added to the recipient's account during each iteration.
        for (uint256 i; i < seasons.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDepositFromAccount(
                sender,
                token,
                seasons[i],
                amounts[i]
            );
            LibTokenSilo.addDepositToAccount(
                recipient,
                token,
                seasons[i],
                amounts[i],
                crateBdv
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    crateBdv.mul(s.ss[token].seeds),
                    _season() - seasons[i]
                )
            );
            bdvs[i] = crateBdv;
        }

        ar.seedsRemoved = ar.bdvRemoved.mul(s.ss[token].seeds);
        ar.stalkRemoved = ar.stalkRemoved.add(
            ar.bdvRemoved.mul(s.ss[token].stalk)
        );

        emit RemoveDeposits(sender, token, seasons, amounts, ar.tokensRemoved);

        // Transfer all the Seeds/Stalk in one batch.
        LibSilo.transferSeedsAndStalk(
            sender,
            recipient,
            ar.seedsRemoved,
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
