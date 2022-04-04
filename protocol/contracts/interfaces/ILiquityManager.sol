/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/

interface ILiquityManager {

	function manageTroveWithApproxHint(uint256 minFee, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) external payable returns (uint256);

	function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) external payable returns (uint256 excessLUSD);

}
