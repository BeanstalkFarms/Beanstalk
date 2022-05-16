// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

interface IBarnraise {
    function totalPodsIssued() external view returns (uint256);
    function currentPodsUnpaid() external view returns (uint256);
}