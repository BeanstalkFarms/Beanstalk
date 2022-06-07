/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";
import "../../libraries/Token/LibTransfer.sol";
import "../../libraries/Token/LibWeth.sol";
import "../../libraries/Token/LibEth.sol";

/**
 * @author Publius
 * @title Transfer Facet handles transfers of assets
 */
contract TokenFacet {
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

    AppStorage internal s;

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
        LibTransfer.transferToken(token, recipient, amount, fromMode, toMode);
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
        for (uint256 i = 0; i < tokens.length; i++) {
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
        for (uint256 i = 0; i < tokens.length; i++) {
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
        for (uint256 i = 0; i < tokens.length; i++) {
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
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = getAllBalance(account, tokens[i]);
        }
    }
}
