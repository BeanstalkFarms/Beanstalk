/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IBlockBasefee.sol";

/**
 * @author Chaikitty
 * @title MockBlockBasefee is a Mock version of Block basefee contract for getting current block's base fee
**/
contract MockBlockBasefee is IBlockBasefee  {

    function block_basefee() external pure override returns (uint256) {
        return 5e9;
    }
}
