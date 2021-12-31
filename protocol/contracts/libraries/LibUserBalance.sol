/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import "./LibAppStorage.sol";
import "./LibUniswap.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";

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

  event BeanAllocation(address indexed account, uint256 beans);

  function getInternalBalances(address account, IERC20[] memory tokens)
    internal
    view
    returns (uint256[] memory balances)
  {
    balances = new uint256[](tokens.length);
    for (uint256 i = 0; i < tokens.length; i++) {
      balances[i] = _getInternalBalance(account, tokens[i]);
    }
  }

  function getCombinedInternalExternalBalance(address account, IERC20 token)
    internal
    view
    returns (uint256 combined_balance)
  {
    combined_balance = token.balanceOf(account).add(_getInternalBalance(account, token));
    return combined_balance;
  }

  function _transferToExternalBalance(
    IERC20 token,
    address sender,
    address recipient,
    uint256 amount, 
    bool fromInternalBalance
  ) internal {
    if (amount > 0) {
      if (fromInternalBalance) _decreaseInternalBalance(sender, token, amount, true);
      token.transferFrom(sender, recipient, amount);
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

  // Takes in IERC20 contract address, and direction (true = fromInternalBalance, false = toInternalBalance)
  // Returns amount to be allocated by Beanstalk on user's behalf
  function checkAndAllocateInternalBalance(address account, IERC20 token, uint256 amount, bool decrease) internal returns (uint256) {
    AppStorage storage s = LibAppStorage.diamondStorage();
    if (decrease) {
	    if (s.internalTokenBalance[account][token] < amount) {
		    _decreaseInternalBalance(account, token, amount, false);
		    return amount;
	    }
	    else {
		    uint256 fromBeanstalk = s.internalTokenBalance[account][token];
		    _decreaseInternalBalance(account, token, fromBeanstalk, false);
	    }
    }
    else {
	    _increaseInternalBalance(account, token, amount);
	    return 0;
    }
  }

  /**
  * Misc Functions relating to internal balances 
 **/

    function allocatedBeans(uint256 transferBeans) internal {
	AppStorage storage s = LibAppStorage.diamondStorage();
        uint wrappedBeans = s.internalTokenBalance[msg.sender][IBean(s.c.bean)];
        uint remainingBeans = transferBeans;
        if (wrappedBeans > 0) {
            if (remainingBeans > wrappedBeans) {
                remainingBeans = transferBeans.sub(wrappedBeans);
		_decreaseInternalBalance(msg.sender, IBean(s.c.bean), wrappedBeans, false);
            } else {
                remainingBeans = 0;
		_decreaseInternalBalance(msg.sender, IBean(s.c.bean), transferBeans, false);
            }
            emit BeanAllocation(msg.sender, transferBeans.sub(remainingBeans));
        }
        if (remainingBeans > 0) IBean(s.c.bean).transferFrom(msg.sender, address(this), remainingBeans);
    }
}
