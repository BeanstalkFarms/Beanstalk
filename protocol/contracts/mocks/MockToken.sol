/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * @author Publius
 * @title Mock Token
**/
contract MockToken is ERC20, ERC20Burnable {

    uint8 private _decimals = 18;

    constructor(string memory name, string memory symbol)
    ERC20(name, symbol)
    { }

    function mint(address account, uint256 amount) external returns (bool) {
        _mint(account, amount);
        return true;
    }

    function burnFrom(address account, uint256 amount) public override(ERC20Burnable) {
        ERC20Burnable.burnFrom(account, amount);
    }

    function burn(uint256 amount) public override(ERC20Burnable) {
        ERC20Burnable.burn(amount);
    }

    function setDecimals(uint256 dec) public {
        _decimals = uint8(dec);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

}