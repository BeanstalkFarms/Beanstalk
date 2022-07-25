/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./ERC20/BeanstalkERC20.sol";

/**
 * @author Publius
 * @title Bean is the ERC-20 Stablecoin for Beanstalk.
**/
contract Bean is BeanstalkERC20  {

    constructor()
    BeanstalkERC20(msg.sender, "Bean", "BEAN")
    { }
}
