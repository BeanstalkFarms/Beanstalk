/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "./ERC20/BeanstalkERC20.sol";

/**
 * @author Publius
 * @title Unripe Bean is the unripe token for the Bean token.
 **/
contract UnripeBean is BeanstalkERC20 {
    constructor() BeanstalkERC20(msg.sender, "Unripe Bean", "urBEAN") {}
}
