/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "../MockToken.sol";

contract Mock3Curve is MockToken {
    uint256 virtual_price;

    constructor() MockToken("Wrapped Ether", "WETH") { }

    function get_virtual_price() external view returns (uint256) {
        return virtual_price;
    }

    function set_virtual_price(uint256 _virtual_price) external {
        virtual_price = _virtual_price;
    }
}
