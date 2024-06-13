/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";

/**
 * @title Mock Attack Facet
 * @notice Facet for simulating attacks by directly manipulating underlying Beanstalk state.
 **/
contract MockAttackFacet {
    function stealBeans(uint256 amount) external {
        C.bean().transfer(msg.sender, amount);
    }
}
