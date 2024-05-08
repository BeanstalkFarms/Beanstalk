/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";

/**
 * @author Publius
 * @title MockSiloToken is a mintable ERC-20 Token.
 **/
contract MockSiloToken is Ownable, ERC20Burnable {
    using LibRedundantMath256 for uint256;

    constructor() ERC20("Bean3Crv", "BEAN3CRV") Ownable(msg.sender) {}

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
        if (allowance(sender, _msgSender()) != type(uint256).max) {
            uint256 allowance = allowance(sender, _msgSender());
            if (amount > allowance) {
                revert("Bean: Transfer amount exceeds allowance.");
            }
            _approve(sender, _msgSender(), allowance.sub(amount));
        }
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
