/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import '../seraph/SeraphProtected.sol';

contract MockSeraph is ISeraph {

    function checkEnter(address, bytes4, bytes calldata, uint256) external override {
    }

    function checkLeave(bytes4) external override 
    {
    }
}