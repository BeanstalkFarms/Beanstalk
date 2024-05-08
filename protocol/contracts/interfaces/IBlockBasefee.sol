// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IBlockBasefee {
    // Returns the base fee of this block in wei
    function block_basefee() external view returns (uint256);
}
