/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { LibCurve, ICurve, IERC20 } from '../../../libraries/LibCurve.sol';
import { AppStorage } from '../../AppStorage.sol';
import { LibUserBalance } from '../../../libraries/LibUserBalance.sol';

/**
 * @author Beasley
 * @title Users call generalized curve functions from LibCurve (for farm facet)
**/

contract CurveFacet {

	function swapOnCurve(uint256 startingAmount, 
                       uint256 minEndAmount, 
                       uint8 fromToken, 
                       uint8 toToken, 
                       address poolAddress, 
                       bool fromInternalBalance, 
                       bool toInternalBalance
  ) public payable returns (uint256) {
    return LibCurve.swapOnCurve(startingAmount, minEndAmount, fromToken, toToken, poolAddress, fromInternalBalance, toInternalBalance);
  }

  function sweepBalanceToToken(uint256 minEndAmount, uint8 fromToken, uint8 toToken, address poolAddress, bool toInternalBalance) public payable returns (uint256) {
    address token = ICurve(poolAddress).coins(fromToken);
    uint256 externalBalance = IERC20(token).balanceOf(msg.sender);
    IERC20(token).transferFrom(msg.sender, address(this), externalBalance);
    LibUserBalance._increaseInternalBalance(msg.sender, IERC20(token), externalBalance);
    return LibCurve.swapOnCurve(LibUserBalance._getInternalBalance(msg.sender, IERC20(token)), minEndAmount, fromToken, toToken, poolAddress, true, toInternalBalance);
  }

	function addLiquidityCurve(uint256[] calldata amounts, uint256 minMintAmount, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable returns (uint256) {
    return LibCurve.addLiquidity(amounts, minMintAmount, poolAddress, fromInternalBalance, toInternalBalance);
  }
   
  function removeLiquidityCurve(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable {
    LibCurve.removeLiquidity(LPAmount, minEndAmounts, poolAddress, fromInternalBalance, toInternalBalance);
  }

  function removeLiquidityImbalanceCurve(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable returns (uint256) {
    return LibCurve.removeLiquidityImbalance(LPAmount, minEndAmounts, poolAddress, fromInternalBalance, toInternalBalance);
  }
}
