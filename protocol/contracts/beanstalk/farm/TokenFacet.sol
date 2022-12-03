/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/Token/LibWeth.sol";
import "~/libraries/Token/LibEth.sol";
import "~/libraries/Token/LibTokenPermit.sol";
import "~/libraries/Token/LibTokenApprove.sol";
import "../AppStorage.sol";
import "../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Transfer Facet handles transfers of assets
 */
contract TokenFacet is ReentrancyGuard {
    struct Balance {
        uint256 internalBalance;
        uint256 externalBalance;
        uint256 totalBalance;
    }

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event InternalBalanceChanged(
        address indexed user,
        IERC20 indexed token,
        int256 delta
    );

     event TokenApproval(
        address indexed owner,
        address indexed spender,
        IERC20 token,
        uint256 amount
    );

    /**
     * Transfer
     **/

    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable {
        LibTransfer.transferToken(
            token,
            msg.sender,
            recipient,
            amount,
            fromMode,
            toMode
        );
    }

    function transferInternalTokenFrom(
        IERC20 token,
        address sender,
        address recipient,
        uint256 amount,
        LibTransfer.To toMode
    ) external payable nonReentrant {
        LibTransfer.transferToken(
            token,
            sender,
            recipient,
            amount,
            LibTransfer.From.INTERNAL,
            toMode
        );

        if (sender != msg.sender) {
            LibTokenApprove.spendAllowance(sender, msg.sender, token, amount);
        }
    }

    /**
     * Approval
     **/

    function approveToken(
        address spender,
        IERC20 token,
        uint256 amount
    ) external payable nonReentrant {
        LibTokenApprove.approve(msg.sender, spender, token, amount);
    }

    function increaseTokenAllowance(
        address spender,
        IERC20 token,
        uint256 addedValue
    ) public virtual nonReentrant returns (bool) {
        LibTokenApprove.approve(
            msg.sender,
            spender,
            token,
            LibTokenApprove.allowance(msg.sender, spender, token).add(addedValue)
        );
        return true;
    }

    function tokenAllowance(
        address account,
        address spender,
        IERC20 token
    ) public view virtual returns (uint256) {
        return LibTokenApprove.allowance(account, spender, token);
    }

    function decreaseTokenAllowance(
        address spender,
        IERC20 token,
        uint256 subtractedValue
    ) public virtual nonReentrant returns (bool) {
        uint256 currentAllowance = LibTokenApprove.allowance(
            msg.sender,
            spender,
            token
        );
        require(
            currentAllowance >= subtractedValue,
            "Silo: decreased allowance below zero"
        );
        LibTokenApprove.approve(
            msg.sender,
            spender,
            token,
            currentAllowance.sub(subtractedValue)
        );
        return true;
    }

    function permitToken(
        address owner,
        address spender,
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        LibTokenPermit.permit(owner, spender, token, value, deadline, v, r, s);
        LibTokenApprove.approve(owner, spender, IERC20(token), value);
    }

    function tokenPermitNonces(address owner)
        public
        view
        virtual
        returns (uint256)
    {
        return LibTokenPermit.nonces(owner);
    }

    /**
     * @dev See {IERC20Permit-DOMAIN_SEPARATOR}.
     */
    // solhint-disable-next-line func-name-mixedcase
    function tokenPermitDomainSeparator() external view returns (bytes32) {
        return LibTokenPermit._domainSeparatorV4();
    }

    /**
     * Weth
     **/

    function wrapEth(uint256 amount, LibTransfer.To mode) external payable {
        LibWeth.wrap(amount, mode);
        LibEth.refundEth();
    }

    function unwrapEth(uint256 amount, LibTransfer.From mode) external payable {
        LibWeth.unwrap(amount, mode);
    }

    /**
     * Getters
     **/

    // Internal

    function getInternalBalance(address account, IERC20 token)
        public
        view
        returns (uint256 balance)
    {
        balance = LibBalance.getInternalBalance(account, token);
    }

    function getInternalBalances(address account, IERC20[] memory tokens)
        external
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getInternalBalance(account, tokens[i]);
        }
    }

    // External

    function getExternalBalance(address account, IERC20 token)
        public
        view
        returns (uint256 balance)
    {
        balance = token.balanceOf(account);
    }

    function getExternalBalances(address account, IERC20[] memory tokens)
        external
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getExternalBalance(account, tokens[i]);
        }
    }

    // Total

    function getBalance(address account, IERC20 token)
        public
        view
        returns (uint256 balance)
    {
        balance = LibBalance.getBalance(account, token);
    }

    function getBalances(address account, IERC20[] memory tokens)
        external
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getBalance(account, tokens[i]);
        }
    }

    // All

    function getAllBalance(address account, IERC20 token)
        public
        view
        returns (Balance memory b)
    {
        b.internalBalance = getInternalBalance(account, token);
        b.externalBalance = getExternalBalance(account, token);
        b.totalBalance = b.internalBalance.add(b.externalBalance);
    }

    function getAllBalances(address account, IERC20[] memory tokens)
        external
        view
        returns (Balance[] memory balances)
    {
        balances = new Balance[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getAllBalance(account, tokens[i]);
        }
    }
}
