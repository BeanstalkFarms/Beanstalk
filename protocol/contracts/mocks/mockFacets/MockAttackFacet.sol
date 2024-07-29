/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {C} from "contracts/C.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {LibAppStorage} from "contracts/libraries/LibAppStorage.sol";
import {LibTransfer} from "contracts/libraries/Token/LibTransfer.sol";
import {LibBalance} from "contracts/libraries/Token/LibBalance.sol";

/**
 * @title Mock Attack Facet
 * @notice Facet for simulating attacks by directly manipulating underlying Beanstalk state.
 **/
contract MockAttackFacet is Invariable {
    AppStorage internal s;

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

    ////// Variations of asset theft, internal and external ///////

    /**
     * @notice Simulates stealing of Beans from Beanstalk diamond.
     * @dev Does not directly trigger an invariant failure.
     */
    function stealBeans(uint256 amount) external {
        C.bean().transfer(msg.sender, amount);
    }

    function exploitUserInternalTokenBalance() public {
        LibBalance.increaseInternalBalance(msg.sender, IERC20(C.UNRIPE_LP), 100_000_000);
    }

    function exploitUserSendTokenInternal() public {
        LibTransfer.sendToken(
            IERC20(C.BEAN_ETH_WELL),
            100_000_000_000,
            msg.sender,
            LibTransfer.To.INTERNAL
        );
    }

    function exploitFertilizer() public {
        s.sys.fert.fertilizedIndex += 100_000_000_000;
    }

    function exploitSop() public {
        s.sys.sop.plentyPerSopToken[C.WETH] = 100_000_000;
    }

    function exploitEarnedBeans() public {
        s.sys.silo.earnedBeans = 100_000_000;
    }

    function exploitPodOrderBeans() public {
        s.sys.orderLockedBeans = 100_000_000;
    }
}
