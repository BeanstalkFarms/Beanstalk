/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {C} from "contracts/C.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";

/**
 * @title Mock Attack Facet
 * @notice Facet for simulating attacks by directly manipulating underlying Beanstalk state.
 **/
contract MockAttackFacet is Invariable {
    /**
     * @notice Simulates stealing of Beans from Beanstalk diamond.
     * @dev Does not directly trigger an invariant failure.
     */
    function stealBeans(uint256 amount) external {
        C.bean().transfer(msg.sender, amount);
    }

    function revert_netFlow() external noNetFlow {
        C.bean().transferFrom(msg.sender, address(this), 1);
    }

    function revert_outFlow() external noOutFlow {
        C.bean().transfer(msg.sender, 1);
    }

    function revert_oneOutFlow() external oneOutFlow(C.BEAN) {
        C.bean().transfer(msg.sender, 1);
        IERC20(C.WETH).transfer(msg.sender, 1);
    }

    function revert_supplyChange() external noSupplyChange {
        C.bean().burn(1);
    }

    function revert_supplyIncrease() external noSupplyIncrease {
        C.bean().mint(msg.sender, 1);
    }
}
