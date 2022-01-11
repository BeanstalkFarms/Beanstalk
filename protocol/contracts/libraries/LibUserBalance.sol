/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import "./LibAppStorage.sol";

/**
 * @author LeoFib
 * @title UserBalance Library handles internal read/write functions for Internal User Balances.
**/

library LibUserBalance {
    
  using SafeMath for uint256;
  using SafeCast for uint256;

  /**
  * @dev Emitted when a user's Internal Balance changes, through interacting using Internal Balance.
  *
  */
  event InternalBalanceChanged(address indexed user, IERC20 indexed token, int256 delta);

  /**
  * @dev Emitted when a user's ERC20 allowance is used to transfer tokens to an external account.
  */
  event ExternalBalanceTransfer(IERC20 indexed token, address indexed sender, address recipient, uint256 amount);

  /**
  * @dev Emitted when a user's ERC20 allowance is used to transfer tokens to an internal account.
  */
  event InternalBalanceTransfer(IERC20 indexed token, address indexed sender, address recipient, uint256 amount);

  function _getBalance(address account, IERC20 token)
    internal
    view
    returns (uint256)
  {
    return token.balanceOf(account).add(_getInternalBalance(account, token));
  }

  function _allocate(
    IERC20 token,
    address account,
    uint256 amount,
    bool fromInternalBalance
  ) internal {
    if (fromInternalBalance) {
      uint256 fromInternal =_decreaseInternalBalance(account, token, amount, true);
      amount = amount.sub(fromInternal);
    }
    if (amount > 0) token.transferFrom(account, address(this), amount);
  }

  function _transfer(
    IERC20 token,
    address sender,
    address recipient,
    uint256 amount, 
    bool fromInternalBalance,
    bool toInternalBalance
  ) internal {
    if (toInternalBalance) _transferToInternalBalance(token, sender, recipient, amount, fromInternalBalance);
    else _transferToExternalBalance(token, sender, recipient, amount, fromInternalBalance);
  }

  function _convertToInternalBalance(
    IERC20 token,
    address account,
    uint256 amount
  ) internal {
    token.transferFrom(account, address(this), amount);
    _increaseInternalBalance(account, token, amount);
  }

  function _convertToExternalBalance(
    IERC20 token,
    address account,
    uint256 amount
  ) internal {
    _decreaseInternalBalance(account, token, amount, false);
    token.transfer(account, amount);
  }

  function _transferToInternalBalance(
    IERC20 token,
    address sender,
    address recipient,
    uint256 amount, 
    bool fromInternalBalance
  ) internal {
    if (amount > 0) {
      uint256 tempAmount = amount;
      if (fromInternalBalance) {
        tempAmount =_decreaseInternalBalance(sender, token, amount, true);
        tempAmount = amount.sub(tempAmount);
      }
      if (tempAmount > 0) token.transferFrom(sender, address(this), tempAmount);
      _increaseInternalBalance(recipient, token, amount);
      emit InternalBalanceTransfer(token, sender, recipient, amount);
    }
  }

  function _transferToExternalBalance(
    IERC20 token,
    address sender,
    address recipient,
    uint256 amount,
    bool fromInternalBalance
  ) internal {
    if (amount > 0) {
      uint256 tempAmount = amount;
      if (fromInternalBalance) {
        tempAmount =_decreaseInternalBalance(sender, token, amount, true);
        if (recipient != address(this)) token.transfer(recipient, tempAmount);
        tempAmount = amount.sub(tempAmount);
      }
      if (tempAmount > 0) token.transferFrom(sender, recipient, tempAmount);
      emit ExternalBalanceTransfer(token, sender, recipient, amount);
    }
  }

  /**
    * @dev Increases `account`'s Internal Balance for `token` by `amount`.
    */
  function _increaseInternalBalance(
    address account,
    IERC20 token,
    uint256 amount
  ) internal {
    uint256 currentBalance = _getInternalBalance(account, token);
    uint256 newBalance = currentBalance.add(amount);
    _setInternalBalance(account, token, newBalance, amount.toInt256());
  }

  /**
    * @dev Decreases `account`'s Internal Balance for `token` by `amount`. If `allowPartial` is true, this function
    * doesn't revert if `account` doesn't have enough balance, and sets it to zero and returns the deducted amount
    * instead.
    */
  function _decreaseInternalBalance(
    address account,
    IERC20 token,
    uint256 amount,
    bool allowPartial
  ) internal returns (uint256 deducted) {
    uint256 currentBalance = _getInternalBalance(account, token);
    require(allowPartial || (currentBalance >= amount), "INSUFFICIENT INTERNAL BALANCE");

    deducted = Math.min(currentBalance, amount);
    // By construction, `deducted` is lower or equal to `currentBalance`, so we don't need to use checked
    // arithmetic.
    uint256 newBalance = currentBalance - deducted;
    _setInternalBalance(account, token, newBalance, -(deducted.toInt256()));
  }

  /**
    * @dev Sets `account`'s Internal Balance for `token` to `newBalance`.
    *
    * Emits an `InternalBalanceChanged` event. This event includes `delta`, which is the amount the balance increased
    * (if positive) or decreased (if negative). To avoid reading the current balance in order to compute the delta,
    * this function relies on the caller providing it directly.
    */
  function _setInternalBalance(
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
  function _getInternalBalance(address account, IERC20 token) internal view returns (uint256) {
    AppStorage storage s = LibAppStorage.diamondStorage();
    return s.internalTokenBalance[account][token];
  }

}