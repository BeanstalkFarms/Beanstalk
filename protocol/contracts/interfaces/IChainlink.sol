// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

interface IChainlink {
    // Returns current ETH price in USD with 8 decimal digits
    function latestAnswer() external view returns (uint256);
}