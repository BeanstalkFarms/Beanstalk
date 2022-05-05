/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import "../LibAppStorage.sol";

/**
 * @author LeoFib
 * @title LibInternalBalance Library handles internal read/write functions for Internal User Balances.
 * Largely inspired by Balancer's Vault
**/

library LibBalance {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using SafeCast for uint256;

  /**
  * @dev Emitted when a user's Internal Balance changes, through interacting using Internal Balance.
  *
  */
  event InternalBalanceChanged(address indexed user, IERC20 indexed token, int256 delta);

  function getBalance(address account, IERC20 token)
    internal
    view
    returns (uint256 combined_balance)
  {
    combined_balance = token.balanceOf(account).add(getInternalBalance(account, token));
    return combined_balance;
  }

  /**
    * @dev Increases `account`'s Internal Balance for `token` by `amount`.
    */
  function increaseInternalBalance(
    address account,
    IERC20 token,
    uint256 amount
  ) internal {
    uint256 currentBalance = getInternalBalance(account, token);
    uint256 newBalance = currentBalance.add(amount);
    setInternalBalance(account, token, newBalance, amount.toInt256());
  }

  /**
    * @dev Decreases `account`'s Internal Balance for `token` by `amount`. If `allowPartial` is true, this function
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
    require(allowPartial || (currentBalance >= amount), "Balance: Insufficnent internal balance");

    deducted = Math.min(currentBalance, amount);
    // By construction, `deducted` is lower or equal to `currentBalance`, so we don't need to use checked
    // arithmetic.
    uint256 newBalance = currentBalance - deducted;
    setInternalBalance(account, token, newBalance, -(deducted.toInt256()));
  }

  /**
    * @dev Sets `account`'s Internal Balance for `token` to `newBalance`.
    *
    * Emits an `InternalBalanceChanged` event. This event includes `delta`, which is the amount the balance increased
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
    s.internalTokenBalance[account][token] = newBalance;
    emit InternalBalanceChanged(account, token, delta);
  }

  /**
    * @dev Returns `account`'s Internal Balance for `token`.
    */
  function getInternalBalance(address account, IERC20 token) internal view returns (uint256) {
    AppStorage storage s = LibAppStorage.diamondStorage();
    return s.internalTokenBalance[account][token];
  }

}