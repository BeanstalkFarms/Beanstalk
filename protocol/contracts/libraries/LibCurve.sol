/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ICurve } from '../interfaces/ICurve.sol';
import { LibUserBalance } from './LibUserBalance.sol';

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	using SafeMath for uint256;

  struct SwapInfo {
    address fromTokenAddress;
    address toTokenAddress;
  }

  /*
   * Add Liquidity
  */
  
  function addLiquidity(uint256[] calldata amounts, uint256 minMintAmount, address poolAddress, bool fromInternalBalance, bool toInternalBalance) internal returns (uint256 LPReturned) {
    if (amounts.length == 2) {
      uint256[2] memory swp = [amounts[0], amounts[1]];
      address[2] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1)];
      transferAmountsTwo(swp, tokens, fromInternalBalance, false);
      if (!toInternalBalance) LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, msg.sender);
      else LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, poolAddress);
    }
    else if (amounts.length == 3) {
      uint256[3] memory swp = [amounts[0], amounts[1], amounts[2]];
      address[3] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2)];
      transferAmountsThree(swp, tokens, fromInternalBalance, false);
      if (!toInternalBalance) LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, msg.sender);
      else LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, poolAddress);
    }
    else {
      uint256[4] memory swp = [amounts[0], amounts[1], amounts[2], amounts[3]];
      address[4] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2), ICurve(poolAddress).coins(3)];
      transferAmountsFour(swp, tokens, fromInternalBalance, false);
      if (!toInternalBalance) LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, msg.sender);
      else LPReturned = ICurve(poolAddress).add_liquidity(swp, minMintAmount, poolAddress);
    }
    if (toInternalBalance) LibUserBalance._increaseInternalBalance(msg.sender, IERC20(poolAddress), LPReturned);
	}

  /*
   * Remove Liquidity
  */

  function removeLiquidity(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) internal {
    if (fromInternalBalance) { // Work with internal balance
      uint256 internalBalance = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(poolAddress), LPAmount, true);
      if (internalBalance != LPAmount) IERC20(poolAddress).transferFrom(msg.sender, address(this), LPAmount.sub(internalBalance));
    }
    else IERC20(poolAddress).transferFrom(msg.sender, address(this), LPAmount);

    if (minEndAmounts.length == 2) {
      uint256[2] memory endAmounts = [minEndAmounts[0], minEndAmounts[1]];
      if (!toInternalBalance) { uint256[2] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts, msg.sender); }
      else {
        uint256[2] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts); // Perform the transfer
        address[2] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1)];
        transferAmountsTwo(amounts, tokens, true, true);
      }
    }
    else if (minEndAmounts.length == 3) {
      uint256[3] memory endAmounts = [minEndAmounts[0], minEndAmounts[1], minEndAmounts[2]];
      if (!toInternalBalance) { uint256[3] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts, msg.sender); }
      else {
        uint256[3] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts); // Perform the transfer
        address[3] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2)];
        transferAmountsThree(amounts, tokens, true, true);
      }
    }
    else {
      uint256[4] memory endAmounts = [minEndAmounts[0], minEndAmounts[1], minEndAmounts[2], minEndAmounts[3]];
      if (!toInternalBalance) { uint256[4] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts, msg.sender); }
      else {
        uint256[4] memory amounts = ICurve(poolAddress).remove_liquidity(LPAmount, endAmounts); // Perform the transfer
        address[4] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2), ICurve(poolAddress).coins(3)];
        transferAmountsFour(amounts, tokens, true, true);
      }
    }
  }

  function removeLiquidityImbalance(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) internal returns (uint256 LPBurned) {
    if (fromInternalBalance) { // Work with internal balance
      uint256 internalBalance = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(poolAddress), LPAmount, true);
      if (internalBalance != LPAmount) IERC20(poolAddress).transferFrom(msg.sender, address(this), LPAmount.sub(internalBalance));
    }
    else IERC20(poolAddress).transferFrom(msg.sender, address(this), LPAmount);

    if (minEndAmounts.length == 2) {
      uint256[2] memory endAmounts = [minEndAmounts[0], minEndAmounts[1]];
      if (!toInternalBalance) LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount, msg.sender);
      else {
        LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount); // Perform the transfer
        address[2] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1)];
        transferAmountsTwo(endAmounts, tokens, true, true);
      }
    }
    else if (minEndAmounts.length == 3) {
      uint256[3] memory endAmounts = [minEndAmounts[0], minEndAmounts[1], minEndAmounts[2]];
      if (!toInternalBalance) LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount, msg.sender);
      else {
        LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount); // Perform the transfer
        address[3] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2)];
        transferAmountsThree(endAmounts, tokens, true, true);
      }
    }
    else {
      uint256[4] memory endAmounts = [minEndAmounts[0], minEndAmounts[1], minEndAmounts[2], minEndAmounts[3]];
      if (!toInternalBalance) LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount, msg.sender);
      else {
        LPBurned = ICurve(poolAddress).remove_liquidity_imbalance(endAmounts, LPAmount); // Perform the transfer
        address[4] memory tokens = [ICurve(poolAddress).coins(0), ICurve(poolAddress).coins(1), ICurve(poolAddress).coins(2), ICurve(poolAddress).coins(3)];
        transferAmountsFour(endAmounts, tokens, true, true);
      }
    }
  }

	/*
	* Swap
  */

  function swapOnCurve(uint256 startingAmount, 
                       uint256 minEndAmount, 
                       uint8 fromToken, 
                       uint8 toToken, 
                       address poolAddress, 
                       bool fromInternalBalance, 
                       bool toInternalBalance
  ) internal returns (uint256 amountReturned) {
    SwapInfo memory x;
    x.fromTokenAddress = ICurve(poolAddress).coins(fromToken);
    x.toTokenAddress = ICurve(poolAddress).coins(toToken);
    if (fromInternalBalance) {
      uint256 internalBalance = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(x.fromTokenAddress), startingAmount, true);
      if (internalBalance != startingAmount) IERC20(x.fromTokenAddress).transferFrom(msg.sender, address(this), startingAmount.sub(internalBalance));
    }
    else IERC20(x.fromTokenAddress).transferFrom(msg.sender, address(this), startingAmount);
		if (!toInternalBalance) amountReturned = ICurve(poolAddress).exchange(fromToken, toToken, startingAmount, minEndAmount, msg.sender);
    else {
      amountReturned = ICurve(poolAddress).exchange(fromToken, toToken, startingAmount, minEndAmount);
      LibUserBalance._increaseInternalBalance(msg.sender, IERC20(x.toTokenAddress), amountReturned);
    }
	}

  /*
   * Helper Functions
   * Unfortunately, Solidity gets mad when you fail to specify the size of arrays, so we have a function for each option.
  */

  function transferAmountsTwo(uint256[2] memory amounts, address[2] memory tokens, bool internalBalance, bool direction) private { // If direction == true, coins are transferred TO user, false, coins transferred FROM user.
    if (direction) {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) LibUserBalance._increaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i]);
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transfer(msg.sender, amounts[i]);
        }
      }
    }
    else {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) {
            uint256 received = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i], true);
            if (received != amounts[i]) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i].sub(received));
          }
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
        }
      }
    }
  }

  function transferAmountsThree(uint256[3] memory amounts, address[3] memory tokens, bool internalBalance, bool direction) private { // If direction == true, coins are transferred TO user, false, coins transferred FROM user.
    if (direction) {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) LibUserBalance._increaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i]);
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transfer(msg.sender, amounts[i]);
        }
      }
    }
    else {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) {
            uint256 received = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i], true);
            if (received != amounts[i]) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i].sub(received));
          }
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
        }
      }
    }
  }

  function transferAmountsFour(uint256[4] memory amounts, address[4] memory tokens, bool internalBalance, bool direction) private { // If direction == true, coins are transferred TO user, false, coins transferred FROM user.
    if (direction) {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) LibUserBalance._increaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i]);
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transfer(msg.sender, amounts[i]);
        }
      }
    }
    else {
      if (internalBalance) {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) {
            uint256 received = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(tokens[i]), amounts[i], true);
            if (received != amounts[i]) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i].sub(received));
          }
        }
      }
      else {
        for (uint8 i = 0; i < amounts.length; i++) {
          if (amounts[i] != 0) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
        }
      }
    }
  }

}

