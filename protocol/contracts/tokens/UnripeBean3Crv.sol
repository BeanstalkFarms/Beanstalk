/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "./ERC20/BeanstalkERC20.sol";

/**
 * @author Publius
 * @title Unripe Bean 3Crv is the Unripe token for the Bean3Crv Token.
 **/
contract UnripeBean3Crv is BeanstalkERC20 {
    constructor() BeanstalkERC20(msg.sender, "Unripe Bean3Crv", "urBEAN3CRV") {}
}
