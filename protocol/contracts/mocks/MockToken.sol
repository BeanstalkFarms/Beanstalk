/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./MockERC20.sol";

/**
 * @author Publius
 * @title Mock Token
**/
contract MockToken is MockERC20 {

    constructor(string memory name, string memory symbol)
    MockERC20(name, symbol)
    { }

    function mint(address account, uint256 amount) external returns (bool) {
        _mint(account, amount);
        return true;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function offlineReset() external {
	_totalSupply = 0;
    }
}
