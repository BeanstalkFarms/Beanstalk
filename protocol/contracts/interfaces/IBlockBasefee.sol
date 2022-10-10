// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

interface IBlockBasefee {
    // Returns the base fee of this block in gwei
    function block_basefee() external view returns (uint256);
}