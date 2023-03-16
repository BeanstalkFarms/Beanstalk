/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/C.sol";
import "~/libraries/Silo/LibSilo.sol";
import "~/libraries/Silo/LibTokenSilo.sol";
import "~/libraries/Silo/LibSiloPermit.sol";
import "~/libraries/Silo/LibLegacyTokenSilo.sol";
import "../SiloFacet/Silo.sol";
import "~/libraries/LibSafeMath32.sol";
import "~/libraries/Convert/LibConvert.sol";
import "~/libraries/LibInternal.sol";
import "../../ReentrancyGuard.sol";
import "../SiloFacet/TokenSilo.sol";

/**
 * @author pizzaman1337, brean
 * @title Handles Approval related functions for the Silo
 **/
contract ApprovalFacet is ReentrancyGuard {
    using SafeMath for uint256;

    event ApprovalForAll(address indexed account, address indexed operator, bool approved);


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
        LibSiloPermit._approveDeposit(msg.sender, spender, token, amount);
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
        LibSiloPermit._approveDeposit(
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
        LibSiloPermit._approveDeposit(msg.sender, spender, token, currentAllowance.sub(subtractedValue));
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
            LibSiloPermit._approveDeposit(owner, spender, tokens[i], values[i]);
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
        LibSiloPermit._approveDeposit(owner, spender, token, value);
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

    // ERC1155 Approvals
    function setApprovalForAll(
        address spender, 
        bool approved
    ) external {
        s.a[msg.sender].isApprovedForAll[spender] = approved;
        emit ApprovalForAll(msg.sender, spender, approved);
    }

    function isApprovedForAll(
        address _owner, 
        address _operator
    ) external view returns (bool) {
        return s.a[_owner].isApprovedForAll[_operator];
    }
}