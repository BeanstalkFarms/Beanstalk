/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {C} from "contracts/C.sol";

/**
 * Initializes the migration onto L2.
 */
contract InitL2Migration {
    address BCM = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    event Pause(uint256 timestamp);

    AppStorage internal s;

    function init() external {
        // Pause beanstalk, preventing future sunrises.
        s.paused = true;
        s.pausedAt = uint128(block.timestamp);
        emit Pause(block.timestamp);

        // transfer the following whitelisted silo assets to the BCM:
        // deposited BEAN:WETH
        // IERC20(C.BEAN_ETH_WELL).transfer(BCM, 1);

        // // BEAN:WstETH
        // IERC20(C.BEAN_WSTETH_WELL).transfer(BCM, 1);

        // // BEAN:3CRV
        // IERC20(C.CURVE_BEAN_METAPOOL).transfer(BCM, 1);
    }
}
