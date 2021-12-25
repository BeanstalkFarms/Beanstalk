/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "./interfaces/ISeed.sol";

/**
 * @author Beasley
 * @title Seed is a derivative ERC-20 Stablecoin for Beanstalk obtained by siloing $BEAN.
**/

contract Seed is Ownable, ERC20Burnable {

    using SafeMath for uint256;

    constructor()
    ERC20("Seed", "SEED")
    { }

    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
      	_mint(account, amount);
      	return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
          ISeed(owner()).updateSilo(sender, 0, 0, true);
       	  ISeed(owner()).updateSilo(recipient, 0, 0, true);
          _transfer(sender, recipient, amount);
          if (allowance(sender, _msgSender()) != uint256(-1)) {
               _approve(
                  sender,
                 _msgSender(),
                  allowance(sender, _msgSender()).sub(amount, "Seed: Transfer amount exceeds allowance."));
        }
        return true;
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
      	ISeed(owner()).updateSilo(recipient, 0, 0, true);
      	_transfer(_msgSender(), recipient, amount);	
      	return true;
    }

    function lightTransferFrom(address sender, address recipient, uint256 amount) public onlyOwner returns (bool) {
    	_transfer(sender, recipient, amount);
     	if (allowance(sender, _msgSender()) != uint256(-1)) {
            _approve(
                sender,
	             	_msgSender(),
                allowance(sender, _msgSender()).sub(amount, "Seed: Transfer amount exceeds allowance."));
       }
    	return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
