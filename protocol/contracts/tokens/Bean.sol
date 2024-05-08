/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "./ERC20/BeanstalkERC20.sol";

/**
 * @author Publius
 * @title Bean is the ERC-20 Stablecoin for Beanstalk.
 **/
contract Bean is BeanstalkERC20 {
    constructor() BeanstalkERC20(msg.sender, "Bean", "BEAN") {}
}
