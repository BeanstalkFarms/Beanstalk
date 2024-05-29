/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

import "contracts/interfaces/IERC1155Receiver.sol";
import "contracts/beanstalk/migration/L1Libraries/LibTransfer.sol";
import "contracts/beanstalk/migration/L1Libraries/LibWeth.sol";
import "contracts/beanstalk/migration/L1Libraries/LibEth.sol";
import "contracts/beanstalk/migration/L1Libraries/LibTokenApprove.sol";
import "contracts/beanstalk/migration/L1AppStorage.sol";
import "contracts/beanstalk/migration/L1ReentrancyGuard.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius
 * @title L1TokenFacet updates the TokenFacet functions due to the L2 Migration.
 * @dev Beanstalk cannot assume that all tokens in Farm Balances can be transferred to
 * an L2. Addditionally, given that Beans will be re-issued on L2, Beanstalk will need to
 * restrict the transfer of beans and bean assets. Permit removed from farm balances due to complexity.
 */
contract L1TokenFacet is IERC1155Receiver, ReentrancyGuard {
    struct Balance {
        uint256 internalBalance;
        uint256 externalBalance;
        uint256 totalBalance;
    }

    using SafeERC20 for IERC20;
    using LibRedundantMath256 for uint256;

    event InternalBalanceChanged(address indexed user, IERC20 indexed token, int256 delta);

    event TokenApproval(
        address indexed owner,
        address indexed spender,
        IERC20 token,
        uint256 amount
    );

    //////////////////////// Transfer ////////////////////////

    /**
     * @notice transfers a token from msg.sender to `recipient`.
     * @dev enables transfers between internal and external balances.
     *
     * @param token The token to transfer.
     * @param recipient The recipient of the transfer.
     * @param amount The amount to transfer.
     * @param fromMode The source of token from the sender. See {LibTransfer.From}.
     * @param toMode The destination of token to the recipient. See {LibTransfer.To}.
     */
    function transferToken(
        IERC20 token,
        address recipient,
        uint256 amount,
        LibTransfer.From fromMode,
        LibTransfer.To toMode
    ) external payable {
        checkBeanAsset(address(token));
        // L1 external -> internal transfers are not supported after the L2 migration.
        if (fromMode != LibTransfer.From.INTERNAL) {
            require(
                toMode == LibTransfer.To.EXTERNAL,
                "TokenFacet: EXTERNAL->INTERNAL transfers are disabled."
            );
        }
        LibTransfer.transferToken(token, msg.sender, recipient, amount, fromMode, toMode);
    }

    /**
     * @notice transfers a token from `sender` to an `recipient` Internal balance.
     * @dev differs from transferToken as it does not use msg.sender.
     */
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

    //////////////////////// Transfer ////////////////////////

    /**
     * @notice approves a token for a spender.
     * @dev this approves a token for both internal and external balances.
     */
    function approveToken(
        address spender,
        IERC20 token,
        uint256 amount
    ) external payable nonReentrant {
        LibTokenApprove.approve(msg.sender, spender, token, amount);
    }

    /**
     * @notice increases approval for a token for a spender.
     */
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

    /**
     * @notice decreases approval for a token for a spender.
     */
    function decreaseTokenAllowance(
        address spender,
        IERC20 token,
        uint256 subtractedValue
    ) public virtual nonReentrant returns (bool) {
        uint256 currentAllowance = LibTokenApprove.allowance(msg.sender, spender, token);
        require(currentAllowance >= subtractedValue, "Silo: decreased allowance below zero");
        LibTokenApprove.approve(msg.sender, spender, token, currentAllowance.sub(subtractedValue));
        return true;
    }

    /**
     * @notice returns the allowance for a token for a spender.
     */
    function tokenAllowance(
        address account,
        address spender,
        IERC20 token
    ) public view virtual returns (uint256) {
        return LibTokenApprove.allowance(account, spender, token);
    }

    //////////////////////// ERC1155Reciever ////////////////////////

    /**
     * @notice ERC1155Reciever function that allows the silo to receive ERC1155 tokens.
     *
     * @dev as ERC1155 deposits are not accepted yet,
     * this function will revert.
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert("Silo: ERC1155 deposits are not accepted yet.");
    }

    /**
     * @notice onERC1155BatchReceived function that allows the silo to receive ERC1155 tokens.
     *
     * @dev as ERC1155 deposits are not accepted yet,
     * this function will revert.
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        revert("Silo: ERC1155 deposits are not accepted yet.");
    }

    //////////////////////// WETH ////////////////////////

    /**
     * @notice wraps ETH into WETH.
     */
    function wrapEth(uint256 amount, LibTransfer.To mode) external payable {
        LibWeth.wrap(amount, mode);
        LibEth.refundEth();
    }

    /**
     * @notice unwraps WETH into ETH.
     */
    function unwrapEth(uint256 amount, LibTransfer.From mode) external payable {
        LibWeth.unwrap(amount, mode);
    }

    //////////////////////// GETTERS ////////////////////////

    /**
     * @notice returns the internal balance of a token for an account.
     */
    function getInternalBalance(
        address account,
        IERC20 token
    ) public view returns (uint256 balance) {
        balance = LibBalance.getInternalBalance(account, token);
    }

    /**
     * @notice returns the internal balances of tokens for an account.
     */
    function getInternalBalances(
        address account,
        IERC20[] memory tokens
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getInternalBalance(account, tokens[i]);
        }
    }

    // External

    /**
     * @notice returns the external balance of a token for an account.
     */
    function getExternalBalance(
        address account,
        IERC20 token
    ) public view returns (uint256 balance) {
        balance = token.balanceOf(account);
    }

    /**
     * @notice returns the external balances of tokens for an account.
     */
    function getExternalBalances(
        address account,
        IERC20[] memory tokens
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getExternalBalance(account, tokens[i]);
        }
    }

    /**
     * @notice returns the total balance (internal and external)
     * of a token
     */
    function getBalance(address account, IERC20 token) public view returns (uint256 balance) {
        balance = LibBalance.getBalance(account, token);
    }

    /**
     * @notice returns the total balances (internal and external)
     * of a token for an account.
     */
    function getBalances(
        address account,
        IERC20[] memory tokens
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getBalance(account, tokens[i]);
        }
    }

    /**
     * @notice returns the total balance (internal and external)
     * of a token, in a balance struct (internal, external, total).
     */
    function getAllBalance(address account, IERC20 token) public view returns (Balance memory b) {
        b.internalBalance = getInternalBalance(account, token);
        b.externalBalance = getExternalBalance(account, token);
        b.totalBalance = b.internalBalance.add(b.externalBalance);
    }

    /**
     * @notice returns the total balance (internal and external)
     * of a token, in a balance struct (internal, external, total).
     */
    function getAllBalances(
        address account,
        IERC20[] memory tokens
    ) external view returns (Balance[] memory balances) {
        balances = new Balance[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            balances[i] = getAllBalance(account, tokens[i]);
        }
    }

    /**
     * @notice verifies that the token is not a Bean asset.
     * @dev bean assets on L1 will be migrated onto L2,
     * and thus requires that these tokens are not transferred.
     */
    function checkBeanAsset(address token) internal pure {
        require(token != address(C.BEAN), "TokenFacet: Beans cannot be transferred.");
        require(
            token != address(C.BEAN_ETH_WELL),
            "TokenFacet: BeanEth Well Tokens cannot be transferred."
        );
        require(
            token != address(C.BEAN_WSTETH_WELL),
            "TokenFacet: BeanwstEth Well Tokens cannot be transferred."
        );
        require(
            token != address(C.CURVE_BEAN_METAPOOL),
            "TokenFacet: Bean3crv Well Tokens cannot be transferred."
        );
    }
}
