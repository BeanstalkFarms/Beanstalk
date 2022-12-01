/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./Silo.sol";

/**
 * @title TokenSilo
 * @author Publius
 * @notice This contract contains functions for depositing, withdrawing and claiming whitelisted Silo tokens.
 * @dev:
 * 
 * ### Scratchpad
 * 
 * "amount" refers to erc20 token balance
 * "bdv" refers to bean denominated value
 * "season" refers to the season number (integer) in which a deposit is made
 * "withdraw" is a request to claim tokens from the Silo (in the future; see {TokenSilo.withdrawFreeze}).
 * "remove" is Beanstalk's internal accounting term for removing a  
 * a withdrawal cannot be partially claimed
 * "Season of Deposit" vs. "Season of Claiming"
 * events are on a per-account-per-token basis, if you want to claim across two tokens, two events are emitted.
 * previous language was "transit" (withdrawn, not claimable) and "receivable" (withdrawn, claimable)
 * "total" refers to the entire amount stored in the Silo
 *
 * FIXME(doc): explain add -> [withdraw/remove] -> claim lifecycle
 * FIXME(doc): agree on name for "Season of Claiming". Alternative: "Season of Arrival" 
 */
contract TokenSilo is Silo {
    uint32 private constant ASSET_PADDING = 100;

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    /**
     * @notice Emitted when `account` adds a single Deposit to the Silo.
     * @param account
     * @param token a whitelisted Silo token
     * @param season Season of Deposit
     * @param amount amount to add to `season`
     * @param bdv the BDV associated with `amount` of `token` at the time of deposit.
     * @dev:
     * 
     * There is no "AddDeposits" event because there is currently no operation in which Beanstalk
     * creates multiple Deposits in different Seasons.
     *
     *  - `deposit()` always places the user's deposit in the current `season()`.
     *  - `convert()` collapses multiple deposits into a single Season to prevent loss of Stalk.
     */
    event AddDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount,
        uint256 bdv
    );

    /**
     * @notice Emitted when a `account` removes a single Deposit from the Silo.
     * 
     * Occur during `withdraw()` and `convert()` operations.
     * 
     * @param account
     * @param token a whitelisted Silo token
     * @param season Season of Deposit to remove from
     * @param amount amount to remove from `season`
     */
    event RemoveDeposit(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    /**
     * @notice Emitted when a `account` removes multiple Deposits from the Silo.
     *
     * Occurs during `withdraw()` and `convert()` operations.
     *
     * @param account
     * @param token a whitelisted Silo token
     * @param seasons Seasons of Deposit to remove from
     * @param amounts amounts to remove from corresponding `seasons`
     * @param amount sum of `amounts`
     */
    event RemoveDeposits(
        address indexed account,
        address indexed token,
        uint32[] seasons,
        uint256[] amounts,
        uint256 amount
    );

    /**
     * @notice Emitted when `account` creates a new Withdrawal.
     * @param account
     * @param token
     * @param season the Season in which this Withdrawal becomes Claimable
     * @param amount amount of `token` withdrawn
     * @dev:
     *
     * NOTE that `season` is the Season of Claiming, not the Season of Deposit.
     */
    event AddWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    /**
     * @notice Emitted when `account` claims a Withdrawal.
     * 
     * The name "RemoveWithdrawal" is used internally for accounting consistency. This
     * action is commonly referred to as "Claiming" assets from the Silo.
     *
     * @param account
     * @param token
     * @param season the Season in which this Withdrawal became Claimable
     * @param amount amount of `token` claimed and delivered to `account`
     */
    event RemoveWithdrawal(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    /**
     * @notice Emitted when `account` claims multiple Withdrawals.
     * @param account
     * @param token
     * @param seasons the Seasons in which Withdrawals became Claimable
     * @param amount the amount of `token` claimed and delivered to `account`
     */
    event RemoveWithdrawals(
        address indexed account,
        address indexed token,
        uint32[] seasons,
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
     * @return amount The number of tokens contained in this deposit.
     * @return bdv The BDV associated with this deposit. See {FIXME(doc)}.
     */
    function getDeposit(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256, uint256) {
        return LibTokenSilo.tokenDeposit(account, token, season);
    }

    /**
     * @notice Find the amount of `token` that `account` has withdrawn from season `season`.
     * @return amount The number of tokens contained in this withdrawal.
     * @dev:
     * 
     * Withdrawals do not store BDV because Stalk & Seeds are burned upon when calling `withdraw()`.
     * 
     * Thus, withdraw-related functions only return the `amount` of tokens withdrawn.
     */
    function getWithdrawal(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256) {
        return LibTokenSilo.tokenWithdrawal(account, token, season);
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
     * Contains the BDV function selector, Stalk per BDV, and Seeds per BDV.
     * 
     * FIXME(naming) getTokenSettings ?
     */
    function tokenSettings(address token)
        external
        view
        returns (Storage.SiloSettings memory)
    {
        return s.ss[token];
    }

    /**
     * @notice Returns the number of Seasons that must elapse before a Withdrawal can be Claimed.
     * @dev:
     * 
     * The purpose of the withdraw freeze is to prevent a malicious user from receiving risk-free 
     * seignorage with the following attack:
     *  1. Right before the end of a Season, deposit assets in the Silo. Receive Stalk.
     *  2. Call `sunrise()` and earn seignorage (Earned Beans).
     *  3. Immediately withdraw assets from the Silo, burning Stalk but keeping Earned Beans.
     * 
     * Early in Beanstalk's life, this value was calculated based on the number of elapsed seasons.
     * It's now hardcoded to its minimum value of 1.
     * 
     * Note: The Silo V3 upgrade will remove the withdrawFreeze entirely. More on this here:
     * https://github.com/BeanstalkFarms/Beanstalk/issues/150
     *
     * FIXME(naming) getWithdrawFreeze ?
     */
    function withdrawFreeze() public view returns (uint8) {
        return s.season.withdrawSeasons;
    }

    /**
     * @notice Returns how much of a `token` Deposit that `spender` can transfer on behalf of `account`.
     * @param account The account that has given `spender` approval to transfer Deposits. 
     * @param spender 
     * @param token
     * @dev `account` is synonymous with "owner" in the ERC20 standard.
     *
     * FIXME(naming): rename `account` to `owner` for consistency with ERC20 & the `DepositAllowance` event?
     * FIXME(naming): getDepositAllowance ?
     */
    function depositAllowance(
        address account,
        address spender,
        address token
    ) public view virtual returns (uint256) {
        return s.a[account].depositAllowances[spender][token];
    }

    //////////////////////// DEPOSIT ////////////////////////

    /**
     * @dev:
     *
     * {LibTokenSilo.deposit} creates a Deposit.
     * {LibSilo.depositSiloAssets} creates the Stalk associated with the Deposit.
     * 
     * This step should enforce that new Deposits are placed into the current `_season()`.
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
        LibSilo.depositSiloAssets(account, seeds, stalk);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /**
     * @dev Withdraw a single Deposit.
     * 
     * Withdrawing a Deposit performs a Removal followed by a Withdraw.
     * See {FIXME(doc)} for an explanation of the Silo asset lifecycle. 
     */
    function _withdrawDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    ) internal {
        (uint256 stalkRemoved, uint256 seedsRemoved, ) = removeDeposit(
            account,
            token,
            season,
            amount
        );
        _withdraw(account, token, amount, stalkRemoved, seedsRemoved);
    }

    /**
     * @dev Withdraw multiple Deposits.
     * 
     * Withdrawing a Deposit performs a Removal followed by a Withdraw.
     * See {FIXME(doc)} for an explanation of the Silo asset lifecycle. 
     *
     * Requirements:
     * 
     * - Each item in `seasons` must have a corresponding item in `amounts`.
     */
    function _withdrawDeposits(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal {
        require(
            seasons.length == amounts.length,
            "Silo: Crates, amounts are diff lengths."
        );
        AssetsRemoved memory ar = removeDeposits(
            account,
            token,
            seasons,
            amounts
        );
        _withdraw(
            account,
            token,
            ar.tokensRemoved,
            ar.stalkRemoved,
            ar.seedsRemoved
        );
    }

    /**
     * @dev Shared between `_withdrawDeposit()` and `_withdrawDeposits()`.
     */
    function _withdraw(
        address account,
        address token,
        uint256 amount,
        uint256 stalk,
        uint256 seeds
    ) private {
        uint32 arrivalSeason = _season() + s.season.withdrawSeasons;
        addTokenWithdrawal(account, token, arrivalSeason, amount); // Increment account & total Withdrawn
        LibTokenSilo.decrementDepositedToken(token, amount); // Decrement total Deposited
        LibSilo.withdrawSiloAssets(account, seeds, stalk); // Burn Seeds and Stalk
    }

    /**
     * @dev Handles Withdrawal accounting.
     *
     * Increment Withdrawn balance of `token` for `account`.
     * Increment total Withdrawn balance of `token`.
     * Emit an AddWithdrawal event.
     *
     * FIXME(naming): since this is private, can we prefix with `_` for consistency?
     * FIXME(naming): LibTokenSilo offers `incrementDepositedToken` to perform the operation 
     * under `/// Global`. Should we create a similar helper for Withdrawals for symmetry?
     */
    function addTokenWithdrawal(
        address account,
        address token,
        uint32 arrivalSeason,
        uint256 amount
    ) private {
        /// Account
        s.a[account].withdrawals[token][arrivalSeason] = s
            .a[account]
            .withdrawals[token][arrivalSeason].add(amount);
        
        /// Total
        s.siloBalances[token].withdrawn = s.siloBalances[token].withdrawn.add(
            amount
        );

        emit AddWithdrawal(account, token, arrivalSeason, amount);
    }

    //////////////////////// REMOVE ////////////////////////

    /**
     * @return stalkRemoved
     * @return seedsRemoved
     * @return bdv
     */
    function removeDeposit(
        address account,
        address token,
        uint32 season,
        uint256 amount
    )
        private
        returns (
            uint256 stalkRemoved,
            uint256 seedsRemoved,
            uint256 bdv
        )
    {
        bdv = LibTokenSilo.removeDeposit(account, token, season, amount);
        seedsRemoved = bdv.mul(s.ss[token].seeds);
        stalkRemoved = bdv.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(seedsRemoved, _season() - season)
        );
        emit RemoveDeposit(account, token, season, amount);
    }

    function removeDeposits(
        address account,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) internal returns (AssetsRemoved memory ar) {
        for (uint256 i; i < seasons.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDeposit(
                account,
                token,
                seasons[i],
                amounts[i]
            );
            ar.bdvRemoved = ar.bdvRemoved.add(crateBdv);
            ar.tokensRemoved = ar.tokensRemoved.add(amounts[i]);
            ar.stalkRemoved = ar.stalkRemoved.add(
                LibSilo.stalkReward(
                    crateBdv.mul(s.ss[token].seeds),
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

    //////////////////////// CLAIM ////////////////////////

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

    function _removeTokenWithdrawal(
        address account,
        address token,
        uint32 season
    ) private returns (uint256) {
        require(
            season <= s.season.current,
            "Claim: Withdrawal not receivable"
        );
        uint256 amount = s.a[account].withdrawals[token][season];
        delete s.a[account].withdrawals[token][season];
        return amount;
    }

    //////////////////////// TRANSFER ////////////////////////

    function _transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) internal returns (uint256) {
        (uint256 stalk, uint256 seeds, uint256 bdv) = removeDeposit(
            sender,
            token,
            season,
            amount
        );
        LibTokenSilo.addDeposit(recipient, token, season, amount, bdv);
        LibSilo.transferSiloAssets(sender, recipient, seeds, stalk);
        return bdv;
    }

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

        for (uint256 i; i < seasons.length; ++i) {
            uint256 crateBdv = LibTokenSilo.removeDeposit(
                sender,
                token,
                seasons[i],
                amounts[i]
            );
            LibTokenSilo.addDeposit(
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
        LibSilo.transferSiloAssets(
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

    function _season() private view returns (uint32) {
        return s.season.current;
    }
}
