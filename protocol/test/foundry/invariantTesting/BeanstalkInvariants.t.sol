// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {C} from "contracts/C.sol";

import {BeanstalkHandler} from "./BeanstalkHandler.sol";
import {TestHelper, LibTransfer, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import "forge-std/Test.sol";

// contract BeanstalkInvariants is StdInvariant, Test {
contract BeanstalkInvariants is TestHelper {
    BeanstalkHandler internal beanstalkHandler;

    IMockFBeanstalk beanstalk = IMockFBeanstalk(BEANSTALK);
    IERC20 weth = IERC20(WETH);
    IERC20 wsteth = IERC20(WSTETH);

    function setUp() public {
        // vm.createSelectFork(vm.envString("FORKING_RPC"), 19976370);

        initializeBeanstalkTestState(true, false);

        // Initialize well to balances. (1000 BEAN/ETH)
        addLiquidityToWell(
            BEAN_ETH_WELL,
            10_000_000e6, // 10,000,000 Beans
            10_000 ether // 10,000 ether.
        );

        addLiquidityToWell(
            BEAN_WSTETH_WELL,
            10_000_000e6, // 10,000,000 Beans
            10_000 ether // 10,000 ether.
        );

        // Fuzz against handler contract.
        beanstalkHandler = new BeanstalkHandler();
        targetContract(address(beanstalkHandler));
    }

    function invariant_contractBalances() public {
        assertGe(
            bean.balanceOf(BEANSTALK),
            beanstalkHandler.depositSumsTotal(BEAN) - beanstalkHandler.withdrawSumsTotal(BEAN)
        );
        assertGe(
            weth.balanceOf(BEANSTALK),
            beanstalkHandler.depositSumsTotal(BEAN_ETH_WELL) -
                beanstalkHandler.withdrawSumsTotal(BEAN_ETH_WELL)
        );
        assertGe(
            wsteth.balanceOf(BEANSTALK),
            beanstalkHandler.depositSumsTotal(BEAN_WSTETH_WELL) -
                beanstalkHandler.withdrawSumsTotal(BEAN_WSTETH_WELL)
        );
    }
}
