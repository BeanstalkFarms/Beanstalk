// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ILegacySilo {
    function lpDeposit(address account, uint32 id) external view returns (uint256, uint256);
    function beanDeposit(address account, uint32 id) external view returns (uint256);
}
