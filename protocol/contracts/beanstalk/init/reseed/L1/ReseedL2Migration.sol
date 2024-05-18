/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Pauses beanstalk on L1, transfers liquidity to the BCM.
 */

interface IBS {
    function getTotalDeposited(address token) external returns (uint256);
}

contract ReseedL2Migration {
    // BCM.
    address internal constant BCM = address(0xa9bA2C40b263843C04d344727b954A545c81D043);

    event Pause(uint256 timestamp);

    AppStorage internal s;

    function init() external {
        // Pause beanstalk, preventing future sunrises.
        s.paused = true;
        s.pausedAt = uint128(block.timestamp);
        emit Pause(block.timestamp);

        // transfer the following whitelisted silo assets to the BCM:
        // deposited BEAN:WETH
        uint256 depositedBeanEth = IBS(address(this)).getTotalDeposited(C.BEAN_ETH_WELL);
        IERC20(C.BEAN_ETH_WELL).transfer(BCM, depositedBeanEth);

        // BEAN:WstETH
        uint256 depositedBeanWsteth = IBS(address(this)).getTotalDeposited(C.BEAN_WSTETH_WELL);
        IERC20(C.BEAN_WSTETH_WELL).transfer(BCM, depositedBeanWsteth);

        // BEAN:3CRV
        uint256 depositedBean3CRV = IBS(address(this)).getTotalDeposited(C.CURVE_BEAN_METAPOOL);
        IERC20(C.CURVE_BEAN_METAPOOL).transfer(BCM, depositedBean3CRV);
    }
}
