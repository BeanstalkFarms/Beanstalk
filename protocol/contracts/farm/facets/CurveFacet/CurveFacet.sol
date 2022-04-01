/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { LibCurve } from '../../../libraries/LibCurve.sol';
import { AppStorage } from '../../AppStorage.sol';

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
  ) public payable returns (uint256 amountReturned) {
    LibCurve.swapOnCurve(startingAmount, minEndAmount, fromToken, toToken, poolAddress, fromInternalBalance, toInternalBalance);
  }

	function addLiquidityCurve(uint256[] calldata amounts, uint256 minMintAmount, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable returns (uint256 LPReturned) {
    LPReturned = LibCurve.addLiquidity(amounts, minMintAmount, poolAddress, fromInternalBalance, toInternalBalance);
  }
   
  function removeLiquidityCurve(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable {
    LibCurve.removeLiquidity(LPAmount, minEndAmounts, poolAddress, fromInternalBalance, toInternalBalance);
  }

  function removeLiquidityImbalanceCurve(uint256 LPAmount, uint256[] calldata minEndAmounts, address poolAddress, bool fromInternalBalance, bool toInternalBalance) public payable returns (uint256 LPBurned) {
    LPBurned = LibCurve.removeLiquidityImbalance(LPAmount, minEndAmounts, poolAddress, fromInternalBalance, toInternalBalance);
  }
}
