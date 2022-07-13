/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


contract Mock3Curve {
    uint256 virtual_price;

    function get_virtual_price() external view returns (uint256) {
        return virtual_price;
    }

    function set_virtual_price(uint256 _virtual_price) external {
        virtual_price = _virtual_price;
    }
}
