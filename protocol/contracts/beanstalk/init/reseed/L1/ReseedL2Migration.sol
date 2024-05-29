/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

import {AppStorage} from "contracts/beanstalk/migration/L1AppStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {C} from "contracts/C.sol";

/**
 * @author Brean
 * @notice Pauses Beanstalk on L1, transfers liquidity to the BCM.
 * @dev all Bean LP tokens are transfered to the BCM, where they will be migrated onto L2.
 * Externally owned Well tokens will need to migrate their beans to L2 manually.
 * Well tokens held in Farm Balances will be migrated to L2 by the ReseedInternalBalances contract.
 */
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
        // bean:eth
        IERC20 beanEth = IERC20(C.BEAN_ETH_WELL);
        uint256 beanEthBalance = beanEth.balanceOf(address(this));
        beanEth.transfer(BCM, beanEthBalance);

        // BEAN:WstETH
        IERC20 beanwsteth = IERC20(C.BEAN_WSTETH_WELL);
        uint256 beanwstethBalance = beanwsteth.balanceOf(address(this));
        beanwsteth.transfer(BCM, beanwstethBalance);

        // BEAN:3CRV
        IERC20 bean3crv = IERC20(C.CURVE_BEAN_METAPOOL);
        uint256 bean3crvBalance = bean3crv.balanceOf(address(this));
        bean3crv.transfer(BCM, bean3crvBalance);
    }
}
