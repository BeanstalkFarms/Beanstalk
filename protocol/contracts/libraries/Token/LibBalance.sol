// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";

/**
 * @title LibInternalBalance
 * @author LeoFib, Publius
 * @notice Handles internal read/write functions for Internal User Balances.
 * Largely inspired by Balancer's Vault.
 */
library LibBalance {
    using SafeERC20 for IERC20;
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;

    /**
     * @notice Emitted when an account's Internal Balance changes.
     * @param account The account whose balance changed.
     * @param token Which token balance changed.
     * @param delta The amount the balance increased (if positive) or decreased (if negative).
     */
    event InternalBalanceChanged(address indexed account, IERC20 indexed token, int256 delta);

    /**
     * @dev Returns the sum of `account`'s Internal and External (ERC20) balance of `token`
     */
    function getBalance(address account, IERC20 token) internal view returns (uint256 balance) {
        balance = token.balanceOf(account).add(getInternalBalance(account, token));
        return balance;
    }

    /**
     * @dev Increases `account`'s Internal Balance of `token` by `amount`.
     */
    function increaseInternalBalance(address account, IERC20 token, uint256 amount) internal {
        uint256 currentBalance = getInternalBalance(account, token);
        uint256 newBalance = currentBalance.add(amount);
        setInternalBalance(account, token, newBalance, amount.toInt256());
    }

    /**
     * @dev Decreases `account`'s Internal Balance of `token` by `amount`. If `allowPartial` is true, this function
     * doesn't revert if `account` doesn't have enough balance, and sets it to zero and returns the deducted amount
     * instead.
     */
    function decreaseInternalBalance(
        address account,
        IERC20 token,
        uint256 amount,
        bool allowPartial
    ) internal returns (uint256 deducted) {
        uint256 currentBalance = getInternalBalance(account, token);
        require(
            allowPartial || (currentBalance >= amount),
            "Balance: Insufficient internal balance"
        );

        deducted = Math.min(currentBalance, amount);
        // By construction, `deducted` is lower or equal to `currentBalance`,
        // so we don't need to use checked arithmetic.
        uint256 newBalance = currentBalance - deducted;
        setInternalBalance(account, token, newBalance, -(deducted.toInt256()));
    }

    /**
     * @dev Sets `account`'s Internal Balance of `token` to `newBalance`.
     *
     * Emits an {InternalBalanceChanged} event. This event includes `delta`, which is the amount the balance increased
     * (if positive) or decreased (if negative). To avoid reading the current balance in order to compute the delta,
     * this function relies on the caller providing it directly.
     */
    function setInternalBalance(
        address account,
        IERC20 token,
        uint256 newBalance,
        int256 delta
    ) private {
        AppStorage storage s = LibAppStorage.diamondStorage();
        delta >= 0
            ? s.sys.internalTokenBalanceTotal[token] = s.sys.internalTokenBalanceTotal[token].add(
                uint256(delta)
            )
            : s.sys.internalTokenBalanceTotal[token] = s.sys.internalTokenBalanceTotal[token].sub(
            uint256(-delta)
        );
        s.accts[account].internalTokenBalance[token] = newBalance;
        emit InternalBalanceChanged(account, token, delta);
    }

    /**
     * @dev Returns `account`'s Internal Balance of `token`.
     */
    function getInternalBalance(
        address account,
        IERC20 token
    ) internal view returns (uint256 balance) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        balance = s.accts[account].internalTokenBalance[token];
    }
}
