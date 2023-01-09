/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "~/beanstalk/ReentrancyGuard.sol";
import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/Silo/LibSiloPermit.sol";

/**
 * @title SiloFacet
 * @author Publius, Brean
 * @notice SiloFacet is the entry point for all Silo functionality.
 * 
 * SiloFacet           public functions for modifying an account's Silo.
 * ↖ TokenSilo         accounting & storage for Deposits, Withdrawals, allowances
 * ↖ Silo              accounting & storage for Seeds, Stalk. and Roots
 * ↖ SiloExit          public view funcs for total balances, account balances 
 *                     & other account state.
 * ↖ ReentrancyGuard   provides reentrancy guard modifier and access to {C}.
 *
 * 
 */
contract SiloFacet is TokenSilo {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    //////////////////////// DEPOSIT ////////////////////////

    /**
     * @notice Deposit `amount` of `token` into the Silo.
     * @param token Address of the whitelisted ERC20 token to Deposit.
     * @param amount The amount of `token` to Deposit.
     * @param mode The balance to pull tokens from. See {LibTransfer-From}.
     *
     * @dev Depositing should:
     * 
     *  1. Transfer `amount` of `token` from `account` to Beanstalk.
     *  2. Calculate the current Bean Denominated Value (BDV) for `amount` of `token`.
     *  3. Create or update a Deposit entry for `account` in the current Season.
     *  4. Mint Stalk and Seeds to `account`.
     *  5. Emit an `AddDeposit` event.
     * 
     * FIXME(logic): return `(amount, bdv(, season))`
     */
    function deposit(
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant mowSender {
        amount = LibTransfer.receiveToken(
            IERC20(token),
            amount,
            msg.sender,
            mode
        );
        _deposit(msg.sender, token, amount);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /** 
     * @notice Withdraws from a single Deposit.
     * @param token Address of the whitelisted ERC20 token to Withdraw.
     * @param season The Season to Withdraw from.
     * @param amount Amount of `token` to Withdraw.
     *
     * @dev When Withdrawing a Deposit, the user must burn all of the Stalk
     * associated with it, including:
     *
     * - base Stalk, received based on the BDV of the Deposit.
     * - Grown Stalk, grown from Seeds while the deposit was held in the Silo.
     *
     * Note that the Grown Stalk associated with a Deposit is a function of the 
     * delta between the current Season and the Season in which a Deposit was made.
     * 
     * Typically, a Farmer wants to withdraw more recent Deposits first, since
     * these require less Stalk to be burned. This functionality is the default
     * provided by the Beanstalk SDK, but is NOT provided at the contract level.
     */
    function withdrawDeposit(
        address token,
        uint32 season,
        uint256 amount,
        LibTransfer.To mode
    ) external payable mowSender nonReentrant {
        _withdrawDeposit(msg.sender, token, season, amount);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /** 
     * @notice Withdraw from multiple Deposits.
     * @param token Address of the whitelisted ERC20 token to Withdraw.
     * @param seasons Seasons to Withdraw from.
     * @param amounts Amounts of `token` to Withdraw from corresponding `seasons`.
     *
     * @dev Clients should factor in gas costs when withdrawing from multiple
     * deposits.
     *
     * For example, if a user wants to withdraw X Beans, it may be preferable to
     * withdraw from 1 older Deposit, rather than from multiple recent Deposits,
     * if the difference in seasons is minimal.
     */
    function withdrawDeposits(
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts,
        LibTransfer.To mode
    ) external payable mowSender nonReentrant {
        uint256 amount = _withdrawDeposits(msg.sender, token, seasons, amounts);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }


    //////////////////////// TRANSFER ////////////////////////

    /** 
     * @notice Transfer a single Deposit.
     * @param sender Current owner of Deposit.
     * @param recipient Destination account of Deposit.
     * @param token Address of the whitelisted ERC20 token to Transfer.
     * @param season Season of Deposit from which to Transfer.
     * @param amount Amount of `token` to Transfer.
     * @return bdv The BDV included in this transfer, now owned by `recipient`.
     *
     * @dev An allowance is required if `sender !== msg.sender`
     * 
     * The {mowSender} modifier is not used here because _both_ the `sender` and
     * `recipient` need their Silo updated, since both accounts experience a
     * change in Seeds. See {Silo-_mow}.
     */
    function transferDeposit(
        address sender,
        address recipient,
        address token,
        uint32 season,
        uint256 amount
    ) external payable nonReentrant returns (uint256 bdv) {
        if (sender != msg.sender) {
            _spendDepositAllowance(sender, msg.sender, token, amount);
        }
        _mow(sender);
        // Need to update the recipient's Silo as well.
        _mow(recipient);
        bdv = _transferDeposit(sender, recipient, token, season, amount);
    }

    /** 
     * @notice Transfers multiple Deposits.
     * @param sender Source of Deposit.
     * @param recipient Destination of Deposit.
     * @param token Address of the whitelisted ERC20 token to Transfer.
     * @param seasons Seasons of Deposit to Transfer. 
     * @param amounts Amounts of `token` to Transfer from corresponding `seasons`.
     * @return bdvs Array of BDV transferred from each Season, now owned by `recipient`.
     *
     * @dev An allowance is required if `sender !== msg.sender`. There must be enough allowance
     * to transfer all of the requested Deposits, otherwise the transaction should revert.
     * 
     * The {mowSender} modifier is not used here because _both_ the `sender` and
     * `recipient` need their Silo updated, since both accounts experience a
     * change in Seeds. See {Silo-_mow}.
     */
    function transferDeposits(
        address sender,
        address recipient,
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable nonReentrant returns (uint256[] memory bdvs) {
        require(amounts.length > 0, "Silo: amounts array is empty");
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Silo: amount in array is 0");
            if (sender != msg.sender) {
                _spendDepositAllowance(sender, msg.sender, token, amounts[i]);
            }
        }
       
        _mow(sender);
        // Need to update the recipient's Silo as well.
        _mow(recipient);
        bdvs = _transferDeposits(sender, recipient, token, seasons, amounts);
    }

    //////////////////////// APPROVE ////////////////////////

    /** 
     * @notice Approve `spender` to Transfer Deposits for `msg.sender`.     
     *
     * Sets the allowance to `amount`.
     * 
     * @dev Gas optimization: We neglect to check whether `token` is actually
     * whitelisted. If a token is not whitelisted, it cannot be Deposited,
     * therefore it cannot be Transferred.
     */
    function approveDeposit(
        address spender,
        address token,
        uint256 amount
    ) external payable nonReentrant {
        require(spender != address(0), "approve from the zero address");
        require(token != address(0), "approve to the zero address");
        _approveDeposit(msg.sender, spender, token, amount);
    }

    /** 
     * @notice Increase the Transfer allowance for `spender`.
     * 
     * @dev Gas optimization: We neglect to check whether `token` is actually
     * whitelisted. If a token is not whitelisted, it cannot be Deposited,
     * therefore it cannot be Transferred.
     *
     * FIXME(doc): why does this return `true`?
     */
    function increaseDepositAllowance(
        address spender,
        address token,
        uint256 addedValue
    ) public virtual nonReentrant returns (bool) {
        _approveDeposit(
            msg.sender,
            spender,
            token,
            depositAllowance(msg.sender, spender, token).add(addedValue)
        );
        return true;
    }

    /** 
     * @notice Decrease the Transfer allowance for `spender`.
     * 
     * @dev Gas optimization: We neglect to check whether `token` is actually
     * whitelisted. If a token is not whitelisted, it cannot be Deposited,
     * therefore it cannot be Transferred.
     * 
     * FIXME(doc): why does this return `true`?
     */
    function decreaseDepositAllowance(
        address spender,
        address token,
        uint256 subtractedValue
    ) public virtual nonReentrant returns (bool) {
        uint256 currentAllowance = depositAllowance(msg.sender, spender, token);
        require(currentAllowance >= subtractedValue, "Silo: decreased allowance below zero");
        _approveDeposit(msg.sender, spender, token, currentAllowance.sub(subtractedValue));
        return true;
    }

    //////////////////////// PERMIT ////////////////////////

    /*
     * Farm balances and silo deposits support EIP-2612 permits, 
     * which allows Farmers to delegate use of their Farm balances 
     * through permits without the need for a separate transaction.
     * https://eips.ethereum.org/EIPS/eip-2612 
     */
    
    /** 
     * @notice permits multiple deposits.
     * @param owner address to give permit
     * @param spender address to permit
     * @param tokens array of ERC20s to permit
     * @param values array of amount (corresponding to tokens) to permit
     * @param deadline expiration of signature (unix time) 
     * @param v recovery id
     * @param r ECDSA signature output
     * @param s ECDSA signature output
     */
    function permitDeposits(
        address owner,
        address spender,
        address[] calldata tokens,
        uint256[] calldata values,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        LibSiloPermit.permits(owner, spender, tokens, values, deadline, v, r, s);
        for (uint256 i; i < tokens.length; ++i) {
            _approveDeposit(owner, spender, tokens[i], values[i]);
        }
    }

    /** 
     * @notice Increases the Deposit Transfer allowance of `spender`.
     * 
     * @param owner address to give permit
     * @param spender address to permit
     * @param token ERC20 to permit
     * @param value amount to permit
     * @param deadline expiration of signature (unix time) 
     * @param v recovery id
     * @param r ECDSA signature output
     * @param s ECDSA signature output
     */
    function permitDeposit(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        LibSiloPermit.permit(owner, spender, token, value, deadline, v, r, s);
        _approveDeposit(owner, spender, token, value);
    }

    /** 
     * @notice Returns the current nonce for Deposit permits.
     */ 
    function depositPermitNonces(address owner) public view virtual returns (uint256) {
        return LibSiloPermit.nonces(owner);
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    function depositPermitDomainSeparator() external view returns (bytes32) {
        return LibSiloPermit._domainSeparatorV4();
    }

    //////////////////////// UPDATE SILO ////////////////////////

    /** 
     * @notice DEPRECATED: Renamed to `mow()`.
     * @dev See {SiloFacet-mow}.
     */
    function update(address account) external payable {
        _mow(account);
    }

    /**
     * @notice Claim Grown Stalk for `account`.
     * @dev See {Silo-_mow}.
     */
    function mow(address account) external payable {
        _mow(account);
    }

    /** 
     * @notice Claim Earned Beans and their associated Stalk & Seeds for 
     * `msg.sender`.
     *
     * The Stalk associated with Earned Beans is commonly called "Earned Stalk".
     * 
     * The Seeds associated with Earned Beans are commonly called "Plantable
     * Seeds". The word "Plantable" is used to highlight that these Seeds aren't 
     * yet earning the Farmer new Stalk. In other words, Seeds do NOT automatically
     * compound; they must first be Planted with {plant}.
     * 
     * In practice, when Seeds are Planted, all Earned Beans are Deposited in 
     * the current Season.
     *
     * FIXME(doc): Publius has suggested we explain `plant()` as "Planting Seeds"
     * and that this happens to deposit Earned Beans, rather than the above approach.
     */
    function plant() external payable returns (uint256 beans) {
        return _plant(msg.sender);
    }

    /** 
     * @notice Claim rewards from a Season Of Plenty (SOP)
     * @dev FIXME(naming): rename to Flood
     */
    function claimPlenty() external payable {
        _claimPlenty(msg.sender);
    }

    //////////////////////// UPDATE UNRIPE DEPOSITS ////////////////////////

    /**
     * @notice Update the BDV of an Unripe Deposit. Allows the user to claim
     * Stalk and Seeds as the BDV of Unripe tokens increases during the Barn
     * Raise. This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     * 
     * {LibTokenSilo-removeDepositFromAccount} should revert if there isn't
     * enough balance of `token` to remove.
     */
    function enrootDeposit(
        address token,
        uint32 season,
        uint256 amount
    ) external nonReentrant mowSender {
        // First, remove Deposit and Redeposit with new BDV
        uint256 ogBDV = LibTokenSilo.removeDepositFromAccount(
            msg.sender,
            token,
            season,
            amount
        );
        emit RemoveDeposit(msg.sender, token, season, amount); // Remove Deposit does not emit an event, while Add Deposit does.

        // Calculate the current BDV for `amount` of `token` and add a Deposit.
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);
        LibTokenSilo.addDepositToAccount(msg.sender, token, season, amount, newBDV); // emits AddDeposit event

        // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
        uint256 deltaBDV = newBDV.sub(ogBDV);

        // Mint Stalk/Seeds associated with the new BDV.
        uint256 deltaSeeds = deltaBDV.mul(s.ss[token].seeds);
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(deltaSeeds, _season() - season)
        );
        LibSilo.mintSeedsAndStalk(msg.sender, deltaSeeds, deltaStalk);
    }

    /** 
     * @notice Update the BDV of Unripe Deposits. Allows the user to claim Stalk
     * and Seeds as the BDV of Unripe tokens increases during the Barn Raise.
     * This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     * {removeDepositsFromAccount} should revert if there isn't enough balance of `token`
     * to remove.
     */
    function enrootDeposits(
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external nonReentrant mowSender {
        // First, remove Deposits because every deposit is in a different season,
        // we need to get the total Stalk/Seeds, not just BDV.
        AssetsRemoved memory ar = removeDepositsFromAccount(msg.sender, token, seasons, amounts);

        // Get new BDV and calculate Seeds (Seeds are not Season dependent like Stalk)
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, ar.tokensRemoved);
        uint256 newStalk;

        // Iterate through all seasons, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < seasons.length; ++i) {
            uint256 bdv = amounts[i].mul(newBDV).div(ar.tokensRemoved); // Cheaper than calling the BDV function multiple times.
            LibTokenSilo.addDepositToAccount(
                msg.sender,
                token,
                seasons[i],
                amounts[i],
                bdv
            );
            newStalk = newStalk.add(
                bdv.mul(s.ss[token].stalk).add(
                    LibSilo.stalkReward(
                        bdv.mul(s.ss[token].seeds),
                        _season() - seasons[i]
                    )
                )
            );
        }

        uint256 newSeeds = newBDV.mul(s.ss[token].seeds);

        // Mint Stalk/Seeds associated with the delta BDV.
        // `newSeeds.sub(...)` will revert if `ar.seedsRemoved > newSeeds`.
        // This enforces the constraint that `ogBDV > newBDV` since the two are
        // linearly related.
        LibSilo.mintSeedsAndStalk(
            msg.sender,
            newSeeds.sub(ar.seedsRemoved),
            newStalk.sub(ar.stalkRemoved)
        );
    }

    //////////////////////// GETTERS ////////////////////////

    function cumulativeGrownStalkPerBdv(IERC20 token)
        view
        returns (int128 _cumulativeGrownStalkPerBdv)
    {
        cumulativeGrownStalkPerBdv = LibTokenSilo.cumulativeGrownStalkPerBdv(
            token
        );
    }

    function grownStalkPerBdvToSeason(IERC20 token, int128 grownStalkPerBdv)
        view
        returns (uint32 season)
    {
        require(LibLegacyTokenSilo.isDepositSeason(token, grownStalkPerBdv, "No matching season for input grownStalkPerBdv"));
        season = LibLegacyTokenSilo.grownStalkPerBdvToSeason(token, grownStalkPerBdv);
    }
}
