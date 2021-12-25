/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @author Beasley
 * @title Seed Interface
**/

abstract contract ISeed is IERC20 {

	function updateSilo(address user, uint256 unwrap_seed_amount, uint256 unwrap_stalk_amount, bool update_silo) public virtual payable;
	function burn(uint256 amount) public virtual;
	function mint(address account, uint256 amount) public virtual returns (bool);
	function burnFrom(address account, uint256 amount) public virtual;
}
