// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "./IPool.sol";


interface IActivePool is IPool {
    
    // --- Functions ---
    function sendETH(address _account, uint _amount) external;
}
