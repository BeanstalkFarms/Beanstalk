/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity =0.7.6;
pragma abicoder v2;

import "./TokenSilo.sol";
import "contracts/libraries/Token/LibTransfer.sol";
import "contracts/libraries/Silo/LibSiloPermit.sol";

/**
 * @title SiloFacet
 * @author Publius, Brean, Pizzaman1337
 * @notice SiloFacet is the entry point for all Silo functionality.
 * 
 * SiloFacet           public functions for modifying an account's Silo.
 * ↖ TokenSilo         accounting & storage for Deposits, Withdrawals, allowances
 * ↖ Silo              accounting & storage for Stalk, and Roots.
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
     * @notice Deposits an ERC20 into the Silo.
     * @dev farmer is issued stalk and seeds based on token (i.e non-whitelisted tokens do not get any)
     * @param token address of ERC20
     * @param amount tokens to be transfered
     * @param mode source of funds (INTERNAL, EXTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT)
     * @dev Depositing should:
     * 
     *  1. Transfer `amount` of `token` from `account` to Beanstalk.
     *  2. Calculate the current Bean Denominated Value (BDV) for `amount` of `token`.
     *  3. Create or update a Deposit entry for `account` in the current Season.
     *  4. Mint Stalk to `account`.
     *  5. Emit an `AddDeposit` event.
     * 
     */
    function deposit(
        address token,
        uint256 _amount,
        LibTransfer.From mode
    ) 
        external
        payable 
        nonReentrant 
        mowSender(token) 
        returns (uint256 amount, uint256 _bdv, int96 stem)
    {
        amount = LibTransfer.receiveToken(
            IERC20(token),
            _amount,
            msg.sender,
            mode
        );
        (_bdv, stem) = _deposit(msg.sender, token, amount);
    }

    //////////////////////// WITHDRAW ////////////////////////

    /** 
     * @notice Withdraws an ERC20 Deposit from the Silo.
     * @param token Address of the whitelisted ERC20 token to Withdraw.
     * @param stem The stem to Withdraw from.
     * @param amount Amount of `token` to Withdraw.
     *
     * @dev When Withdrawing a Deposit, the user must burn all of the Stalk
     * associated with it, including:
     *
     * - base Stalk, received based on the BDV of the Deposit.
     * - Grown Stalk, grown from BDV and stalkEarnedPerSeason while the deposit was held in the Silo.
     *
     * Note that the Grown Stalk associated with a Deposit is a function of the 
     * delta between the current Season and the Season in which a Deposit was made.
     * 
     * Typically, a Farmer wants to withdraw more recent Deposits first, since
     * these require less Stalk to be burned. This functionality is the default
     * provided by the Beanstalk SDK, but is NOT provided at the contract level.
     * 
     */
    function withdrawDeposit(
        address token,
        int96 stem,
        uint256 amount,
        LibTransfer.To mode
    ) external payable mowSender(token) nonReentrant checkVesting {
        _withdrawDeposit(msg.sender, token, stem, amount);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /** 
     * @notice Claims ERC20s from multiple Withdrawals.
     * @param token Address of the whitelisted ERC20 token to Withdraw.
     * @param stems stems to Withdraw from.
     * @param amounts Amounts of `token` to Withdraw from corresponding `stems`.
     * 
     * deposits.
     * @dev Clients should factor in gas costs when withdrawing from multiple
     * 
     * For example, if a user wants to withdraw X Beans, it may be preferable to
     * withdraw from 1 older Deposit, rather than from multiple recent Deposits,
     * if the difference in stems is minimal to save on gas.
     */

    function withdrawDeposits(
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts,
        LibTransfer.To mode
    ) external payable mowSender(token) nonReentrant checkVesting {
        uint256 amount = _withdrawDeposits(msg.sender, token, stems, amounts);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }


    //////////////////////// TRANSFER ////////////////////////

    /** 
     * @notice Transfer a single Deposit.
     * @param sender Current owner of Deposit.
     * @param recipient Destination account of Deposit.
     * @param token Address of the whitelisted ERC20 token to Transfer.
     * @param stem stem of Deposit from which to Transfer.
     * @param amount Amount of `token` to Transfer.
     * @return _bdv The BDV included in this transfer, now owned by `recipient`.
     *
     * @dev An allowance is required if `sender !== msg.sender`
     * 
     * The {mowSender} modifier is not used here because _both_ the `sender` and
     * `recipient` need their Silo updated, since both accounts experience a
     * change in deposited BDV. See {Silo-_mow}.
     */
    function transferDeposit(
        address sender,
        address recipient,
        address token,
        int96 stem,
        uint256 amount
    ) public payable nonReentrant returns (uint256 _bdv) {
        if (sender != msg.sender) {
            LibSiloPermit._spendDepositAllowance(sender, msg.sender, token, amount);
        }
        LibSilo._mow(sender, token);
        // Need to update the recipient's Silo as well.
        LibSilo._mow(recipient, token);
        _bdv = _transferDeposit(sender, recipient, token, stem, amount);
    }

    /** 
     * @notice Transfers multiple Deposits.
     * @param sender Source of Deposit.
     * @param recipient Destination of Deposit.
     * @param token Address of the whitelisted ERC20 token to Transfer.
     * @param stem stem of Deposit to Transfer. 
     * @param amounts Amounts of `token` to Transfer from corresponding `stem`.
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
        int96[] calldata stem,
        uint256[] calldata amounts
    ) public payable nonReentrant returns (uint256[] memory bdvs) {
        require(amounts.length > 0, "Silo: amounts array is empty");
        for (uint256 i = 0; i < amounts.length; ++i) {
            require(amounts[i] > 0, "Silo: amount in array is 0");
            if (sender != msg.sender) {
                LibSiloPermit._spendDepositAllowance(sender, msg.sender, token, amounts[i]);
            }
        }
       
        LibSilo._mow(sender, token);
        // Need to update the recipient's Silo as well.
        LibSilo._mow(recipient, token);
        bdvs = _transferDeposits(sender, recipient, token, stem, amounts);
    }

    

    /**
     * @notice Transfer a single Deposit, conforming to the ERC1155 standard.
     * @param sender Source of Deposit.
     * @param recipient Destination of Deposit.
     * @param depositId ID of Deposit to Transfer.
     * @param amount Amount of `token` to Transfer.
     * 
     * @dev the depositID is the token address and stem of a deposit, 
     * concatinated into a single uint256.
     * 
     */
    function safeTransferFrom(
        address sender, 
        address recipient, 
        uint256 depositId, 
        uint256 amount,
        bytes calldata
    ) external {
        require(recipient != address(0), "ERC1155: transfer to the zero address");
        // allowance requirements are checked in transferDeposit
        (address token, int96 cumulativeGrownStalkPerBDV) = 
            LibBytes.unpackAddressAndStem(depositId);
        transferDeposit(
            sender, 
            recipient,
            token, 
            cumulativeGrownStalkPerBDV, 
            amount
        );
    }

    /**
     * @notice Transfer a multiple Deposits, conforming to the ERC1155 standard.
     * @param sender Source of Deposit.
     * @param recipient Destination of Deposit.
     * @param depositIds list of ID of deposits to Transfer.
     * @param amounts list of amounts of `token` to Transfer.
     * 
     * @dev {transferDeposits} can be used to transfer multiple deposits, but only 
     * if they are all of the same token. Since the ERC1155 standard requires the abilty
     * to transfer any set of depositIDs, the {transferDeposits} function cannot be used here.
     */
    function safeBatchTransferFrom(
        address sender, 
        address recipient, 
        uint256[] calldata depositIds, 
        uint256[] calldata amounts, 
        bytes calldata
    ) external {
        require(depositIds.length == amounts.length, "Silo: depositIDs and amounts arrays must be the same length");
        require(recipient != address(0), "ERC1155: transfer to the zero address");
        // allowance requirements are checked in transferDeposit
        address token;
        int96 cumulativeGrownStalkPerBDV;
        for(uint i; i < depositIds.length; ++i) {
            (token, cumulativeGrownStalkPerBDV) = 
                LibBytes.unpackAddressAndStem(depositIds[i]);
            transferDeposit(
                sender, 
                recipient,
                token, 
                cumulativeGrownStalkPerBDV, 
                amounts[i]
            );
        }
    }

    //////////////////////// YIELD DISTRUBUTION ////////////////////////

    /**
     * @notice Claim Grown Stalk for `account`.
     * @dev See {Silo-_mow}.
     */
    function mow(address account, address token) external payable {
        LibSilo._mow(account, token);
    }

    //function to mow multiple tokens given an address
    function mowMultiple(address account, address[] calldata tokens) external payable {
        for (uint256 i; i < tokens.length; ++i) {
            LibSilo._mow(account, tokens[i]);
        }
    }


    /** 
     * @notice Claim Earned Beans and their associated Stalk and Plantable Seeds for
     * `msg.sender`.
     *
     * The Stalk associated with Earned Beans is commonly called "Earned Stalk".
     * Earned Stalk DOES contribute towards the Farmer's Stalk when earned beans is issued.
     * 
     * The Seeds associated with Earned Beans are commonly called "Plantable
     * Seeds". The word "Plantable" is used to highlight that these Seeds aren't 
     * yet earning the Farmer new Stalk. In other words, Seeds do NOT automatically
     * compound; they must first be Planted with {plant}.
     * 
     * In practice, when Seeds are Planted, all Earned Beans are Deposited in 
     * the current Season.
     */
    function plant() external payable returns (uint256 beans, int96 stem) {
        return _plant(msg.sender);
    }

    /** 
     * @notice Claim rewards from a Flood (Was Season of Plenty)
     */
    function claimPlenty() external payable {
        _claimPlenty(msg.sender);
    }

    function bdv(address token, uint256 amount)
        external
        view
        returns (uint256 _bdv)
    {
        _bdv = LibTokenSilo.beanDenominatedValue(token, amount);
    }

}
