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

        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0x01))
        );
    }

    // 1 WBTC = 50000 USD
    // 1e8 = 50000 USD
    function test_getUsdPrice() public {
        // encode type 0x01
        uint256 price = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC);
        // 1e8 / 50000 = 2000
        assertEq(price, 2000);

        // change encode type to 0x02, with a wbtc/usdc pool.
        // todo: fix once oracle fixes come in.
        // vm.prank(BEANSTALK);
        // bs.updateOracleImplementationForToken(
        //     WBTC,
        //     IMockFBeanstalk.Implementation(WBTC_USDC_03_POOL, bytes4(0), bytes1(0x02))
        // );
        // price = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC);
        // assertApproxEqRel(price, 2000, 0.001e18);
    }
}
