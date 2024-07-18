// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {OracleFacet} from "contracts/beanstalk/sun/OracleFacet.sol";

/**
 * @notice Tests the functionality of the Oracles.
 */
contract OracleTest is TestHelper {
    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    function test_getUsdPrice() public {
        // encode type 0x01
        uint256 price = OracleFacet(BEANSTALK).getUsdPrice(WBTC);
        assertEq(price, 50000e6);

        // change encode type to 0x02:
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(WBTC_USDC_03_POOL, bytes4(0), bytes1(0x02))
        );
        price = OracleFacet(BEANSTALK).getUsdPrice(WBTC);
        assertApproxEqRel(price, 50000e6, 0.001e18);
    }
}
