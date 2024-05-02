/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * @author Publius
 * @title MockSiloToken is a mintable ERC-20 Token.
 **/
contract MockSiloToken is Ownable, ERC20Burnable {
    constructor() ERC20("Bean3Crv", "BEAN3CRV") {}

    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        _mint(account, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        _transfer(sender, recipient, amount);
        uint256 allowance = allowance(sender, _msgSender());
        require(allowance >= amount, "Bean: Transfer amount exceeds allowance.");
        if (allowance(sender, _msgSender()) != uint256(-1)) {
            _approve(sender, _msgSender(), allowance - amount);
        }
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
