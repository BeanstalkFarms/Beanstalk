// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "./IPool.sol";


interface IDefaultPool is IPool {

    // --- Functions ---
    function sendETHToActivePool(uint _amount) external;
}
