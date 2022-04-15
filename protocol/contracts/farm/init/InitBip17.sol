/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IBean} from "../../interfaces/IBean.sol";

/**
 * @author Publius
 * @title InitBip17 initializes BIP-17: It funds the Bean Sprout Q2 2022 Budget.
**/

contract InitBip17 {

    address private constant bean = 0xDC59ac4FeFa32293A95889Dc396682858d52e5Db; // Bean Address
    address private constant beanSprout = 0xb7ab3f0667eFF5e2299d39C23Aa0C956e8982235; // Bean Sprout Address
    uint256 private constant beanSproutBudget = 3_000_000 * 1e6; // 3,000,000 Beans

    function init() external {
        IBean(bean).mint(beanSprout, beanSproutBudget);
    }
}