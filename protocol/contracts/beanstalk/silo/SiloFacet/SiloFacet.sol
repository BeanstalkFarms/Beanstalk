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
 * @author Publius
 * @title SiloFacet handles depositing, withdrawing and claiming whitelisted Silo tokens.
 */
contract SiloFacet is TokenSilo {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    //////////////////////// DEPOSIT ////////////////////////

    /**
     * @notice Deposit `amount` of `token` into the Silo.
     * @param token The address of the token to Deposit. Must be Whitelisted.
     * @param amount The amount of `token` to Deposit.
     * @param mode The balance to pull tokens from. See {LibTransfer.From}.
     *
     * @dev:
     * 
     * Depositing should:
     *  1. Transfer `amount` of `token` from `account` to Beanstalk.
     *  2. Calculate the current Bean Denominated Value (BDV) for `amount` of `token`.
     *  3. Create a Deposit entry for `account` in the current Season.
     *  4. Allocate Stalk and Seeds to `account`.
     *  5. Emit an `AddDeposit` event.
     *
     * FIXME(doc): explain "create a deposit" entry, "allocate stalk and seeds", etc.
     * FIXME(doc): why is this payable?
     */
    function deposit(
        address token,
        uint256 amount,
        LibTransfer.From mode
    ) external payable nonReentrant updateSilo {
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
     * @notice withdraws from a single deposit.
     * @param token address of ERC20
     * @param season season the farmer wants to withdraw
     * @param amount tokens to be withdrawn
     *
     * @dev:
     * Season determines how much Stalk and Seeds are removed from the Farmer.
     * Typically the user wants to withdraw from the latest season, as it has the lowest stalk allocation.
     * We rely on the subgraph in order to query farmer deposits.
     */
    function withdrawDeposit(
        address token,
        uint32 season,
        uint256 amount
    ) external payable updateSilo {
        _withdrawDeposit(msg.sender, token, season, amount);
    }

    /** 
     * @notice withdraws from multiple deposits.
     * @param token address of ERC20
     * @param seasons array of seasons to withdraw from
     * @param amounts array of amounts corresponding to each season to withdraw from

     * @dev:
     *
     * Factor in gas costs when withdrawing from multiple deposits to ensure greater UX.
     *
     * For example, if a user wants to withdraw X beans, its better to withdraw from 1 earlier deposit
     * rather than multiple smaller recent deposits, if the season difference is minimal.
     */
    function withdrawDeposits(
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external payable updateSilo {
        _withdrawDeposits(msg.sender, token, seasons, amounts);
    }

    //////////////////////// CLAIM ////////////////////////

    /** 
     * @notice claims tokens from a withdrawal.
     * @param token address of ERC20
     * @param season season to claim
     * @param mode destination of funds (INTERNAL, EXTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT)
     */
    function claimWithdrawal(
        address token,
        uint32 season,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = _claimWithdrawal(msg.sender, token, season);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /** 
     * @notice claims tokens from multiple withdrawals.
     * @param token address of ERC20
     * @param seasons array of seasons to claim
     * @param mode destination of funds (INTERNAL, EXTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT)
     */
    function claimWithdrawals(
        address token,
        uint32[] calldata seasons,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = _claimWithdrawals(msg.sender, token, seasons);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    //////////////////////// TRANSFER ////////////////////////

    /** 
     * @notice transfers single farmer deposit.
     * @param sender source of deposit
     * @param recipient destination of deposit
     * @param token address of ERC20
     * @param season season of deposit to transfer
     * @param amount tokens to transfer
     * @return bdv Bean Denominated Value of transfer
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
        _update(sender);
        // Need to update the recipient's Silo as well.
        _update(recipient);
        bdv = _transferDeposit(sender, recipient, token, season, amount);
    }

    /** 
     * @notice transfers multiple farmer deposits.
     * @param sender source of deposit
     * @param recipient destination of deposit
     * @param token address of ERC20
     * @param seasons array of seasons to withdraw from
     * @param amounts array of amounts corresponding to each season to withdraw from
     * @return bdvs array of Bean Denominated Value of transfer corresponding from each season
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
       
        _update(sender);
        // Need to update the recipient's Silo as well.
        _update(recipient);
        bdvs = _transferDeposits(sender, recipient, token, seasons, amounts);
    }

    //////////////////////// APPROVE ////////////////////////

    /** 
     * @notice approves an address to access a farmers deposit.
     * @param spender address to be given approval
     * @param token address of ERC20
     * @param amount amount to be approved
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
     * @notice increases allowance of deposit.
     * @param spender address to increase approval
     * @param token address of ERC20
     * @param addedValue additional value to be given 
     * @return bool success
     */
    function increaseDepositAllowance(address spender, address token, uint256 addedValue) public virtual nonReentrant returns (bool) {
        _approveDeposit(msg.sender, spender, token, depositAllowance(msg.sender, spender, token).add(addedValue));
        return true;
    }

    /** 
     * @notice decreases allowance of deposit.
     * @param spender address to decrease approval
     * @param token address of ERC20
     * @param subtractedValue amount to be removed 
     * @return bool success
     */
    function decreaseDepositAllowance(address spender, address token, uint256 subtractedValue) public virtual nonReentrant returns (bool) {
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
     * @notice permits deposit.
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
     * @notice returns nonce of deposit permits.
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
     * @notice updates farmer state
     * @dev accredits grown stalk
     * @param account address to update
     */
    function update(address account) external payable {
        _update(account);
    }

    /** 
     * @notice accredits earned beans and stalk to farmer
     * @return beans amount of earned beans given
     */
    function plant() external payable returns (uint256 beans) {
        return _plant(msg.sender);
    }

    /** 
     * @notice claims rewards from a Season Of Plenty (SOP)
     */
    function claimPlenty() external payable {
        _claimPlenty(msg.sender);
    }

    //////////////////////// UPDATE UNRIPE DEPOSITS ////////////////////////

    /** 
     * @notice updates unripe deposit
     * @param token address of ERC20
     * @param _season season to enroot
     * @param amount amount to enroot
     */
    function enrootDeposit(
        address token,
        uint32 _season,
        uint256 amount
    ) external nonReentrant updateSilo {
        // First, remove Deposit and Redeposit with new BDV
        uint256 ogBDV = LibTokenSilo.removeDeposit(
            msg.sender,
            token,
            _season,
            amount
        );
        emit RemoveDeposit(msg.sender, token, _season, amount); // Remove Deposit does not emit an event, while Add Deposit does.
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);
        LibTokenSilo.addDeposit(msg.sender, token, _season, amount, newBDV);

        // Calculate the different in BDV. Will fail if BDV is lower.
        uint256 deltaBDV = newBDV.sub(ogBDV);

        // Calculate the new Stalk/Seeds associated with BDV and increment Stalk/Seed balances
        uint256 deltaSeeds = deltaBDV.mul(s.ss[token].seeds);
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalk).add(
            LibSilo.stalkReward(deltaSeeds, _season() - _season)
        );
        LibSilo.depositSiloAssets(msg.sender, deltaSeeds, deltaStalk);
    }

    /** 
     * @notice adds Revitalized Stalk and Seeds to your Stalk and Seed balances
     * @dev only applies to unripe assets
     * @param token address of ERC20
     * @param seasons array of seasons to enroot
     * @param amounts array of amount (corresponding to seasons) to enroot
     */
    function enrootDeposits(
        address token,
        uint32[] calldata seasons,
        uint256[] calldata amounts
    ) external nonReentrant updateSilo {
        // First, remove Deposits because every deposit is in a different season, we need to get the total Stalk/Seeds, not just BDV
        AssetsRemoved memory ar = removeDeposits(msg.sender, token, seasons, amounts);

        // Get new BDV and calculate Seeds (Seeds are not Season dependent like Stalk)
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, ar.tokensRemoved);
        uint256 newStalk;

        // Iterate through all seasons, redeposit the tokens with new BDV and summate new Stalk.
        for (uint256 i; i < seasons.length; ++i) {
            uint256 bdv = amounts[i].mul(newBDV).div(ar.tokensRemoved); // Cheaper than calling the BDV function multiple times.
            LibTokenSilo.addDeposit(
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

        // Add new Stalk
        LibSilo.depositSiloAssets(
            msg.sender,
            newSeeds.sub(ar.seedsRemoved),
            newStalk.sub(ar.stalkRemoved)
        );
    }
}
