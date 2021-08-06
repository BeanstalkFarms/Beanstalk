/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;

import "./MockToken.sol";

/**
 * @author Publius
 * @title Mock WETH
**/
contract MockWETH is MockToken {

    constructor() MockToken("Wrapped Ether", "WETH") { }

    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    receive() external payable {
        deposit();
    }
    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        require(balanceOf(msg.sender) >= wad);
        _transfer(msg.sender, address(this), wad);
        (bool success,) = msg.sender.call{ value: wad }("");
        require(success, "MockWETH: Transfer failed.");
        emit Withdrawal(msg.sender, wad);
    }

}
