/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract Mock3Curve is ERC20Burnable {
    uint256 virtual_price;

    constructor()
    ERC20("ThreeCurve", "3CRV")
    {}

    function get_virtual_price() external view returns (uint256) {
        return virtual_price;
    }

    function set_virtual_price(uint256 _virtual_price) external {
        virtual_price = _virtual_price;
    }
    
    function mint(address account, uint256 amount) external returns (bool) {
        _mint(account, amount);
        return true;
    }

}
