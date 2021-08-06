/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

/**
 * @author Publius
 * @title Bean is the ERC-20 Stablecoin for Beanstalk.
**/
contract Bean is Ownable, ERC20Burnable  {

    using SafeMath for uint256;

    constructor()
    ERC20("Bean", "BEAN")
    { }

    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        _mint(account, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        if (allowance(sender, _msgSender()) != uint256(-1)) {
            _approve(
                sender,
                _msgSender(),
                allowance(sender, _msgSender()).sub(amount, "Bean: Transfer amount exceeds allowance."));
        }
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

}
