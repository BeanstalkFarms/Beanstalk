// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity =0.7.6;

interface ILegacySilo {
    function lpDeposit(address account, uint32 id) external view returns (uint256, uint256);
    function beanDeposit(address account, uint32 id) external view returns (uint256);
}