// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer} from "test/foundry/utils/TestHelper.sol";

/**
 * @notice Tests the functionality of the gauge.
 */
contract GaugeTest is TestHelper {
    
    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }
}