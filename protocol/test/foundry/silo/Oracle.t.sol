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

    function testUniswapOracleImplementation() public {
        // encode type 0x01
        uint256 price = OracleFacet(BEANSTALK).getUsdPrice(WBTC);
        assertEq(price, 1e24 / 50000e6, "price using encode type 0x01");

        // change encode type to 0x02:
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(WBTC_USDC_03_POOL, bytes4(0), bytes1(0x02))
        );
        price = OracleFacet(BEANSTALK).getUsdPrice(WBTC);
        // 1 USDC will get ~500 satoshis of BTC at $50k
        // 1 USDC = 1e6
        // 1 wBTC = 1e8
        // $50,000/100000000*1000000 = 500
        // function returns uint256(1e24).div(tokenPrice);
        // expected delta is 0.2004008016032064%
        assertApproxEqRel(price, 1e24 / 500, 2.1e15, "price using encode type 0x02");
    }

    function testGetTokenPrice() public view {
        // token price is number of dollars per token, i.e. 50000 USD for 1 WBTC
        uint256 tokenPriceEth = OracleFacet(BEANSTALK).getTokenPrice(C.WETH); // 1000e6
        assertEq(tokenPriceEth, 1000e6, "tokenPriceEth");

        // number of tokens received per dollar
        uint256 usdPriceEth = OracleFacet(BEANSTALK).getUsdPrice(C.WETH); // 1e15 which is 1e18 (1 eth in wei) / 1000 (weth price 1000), you get 1/1000th of 1 eth for $1
        assertEq(usdPriceEth, 1e18 / 1000, "usdPriceEth");

        uint256 tokenPriceWBTC = OracleFacet(BEANSTALK).getTokenPrice(WBTC); // should be 50000e6
        assertEq(tokenPriceWBTC, 50000e6, "tokenPriceWBTC");
        // assertEq(tokenPrice, 50000e6, "price using encode type 0x01");

        // number of tokens received per dollar
        uint256 usdPriceWBTC = OracleFacet(BEANSTALK).getUsdPrice(WBTC); // $1 = 0.00002 wbtc, wbtc is 8 decimals. 1e24 / 50000e6
        assertEq(usdPriceWBTC, 1e24 / 50000e6, "usdPriceWBTC");
    }

    // test provided by T1MOH
    function test_getUsdPrice_whenExternalToken_priceIsInvalid() public view {
        // pre condition: encode type 0x01

        // WETH price is 1000
        uint256 priceWETH = OracleFacet(BEANSTALK).getUsdPrice(C.WETH);
        assertEq(priceWETH, 1e15); //  1e18/1e3 = 1e15

        // WBTC price is 50000
        uint256 priceWBTC = OracleFacet(BEANSTALK).getUsdPrice(WBTC);
        assertEq(priceWBTC, 2e13); // 1e24.div(50000e6) = 2e13
    }

    // TODO: fork tests to verify the on-chain values currently returned by oracles alignes with mocks?
}
