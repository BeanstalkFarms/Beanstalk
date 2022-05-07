/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @author Publius
 * @title Sprout is the ERC-20 Token that produces 1 Bean over time.
**/
contract Sprout is Ownable, ERC20  {

    using SafeMath for uint256;

    // address constant BEANSTALK = '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5';
    uint256 beansSprouted = 0;

    constructor()
    ERC20("Sprout", "SPROUT")
    { }

    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        _mint(account, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        if (allowance(sender, _msgSender()) != type(uint256).max) {
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

    function sproutBeans(uint256 amount) external {

    } 

}
