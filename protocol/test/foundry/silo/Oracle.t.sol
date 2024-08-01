// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {OracleFacet} from "contracts/beanstalk/sun/OracleFacet.sol";
import {MockChainlinkAggregator} from "contracts/mocks/chainlink/MockChainlinkAggregator.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {StakingEthChainlinkOracle} from "contracts/ecosystem/oracles/StakingEthChainlinkOracle.sol";

/**
 * @notice Tests the functionality of the Oracles.
 */
contract OracleTest is TestHelper {
    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    // 1 WBTC = 50000 USD
    // 1e8 = 50000 USD
    function test_getUsdPrice() public {
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(address(0), bytes4(0), bytes1(0x01))
        );

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

    /**
     * @notice verifies functionality with StakingEthChainlinkOracle.sol.
     */
    function test_staking_eth_oracle() public {
        address token = initializeMockStakingEthToken();
        // check price:
        uint256 usdSteth2Price = bs.getUsdTokenPrice(token);
        assertEq(usdSteth2Price, 1e15, "usdSteth2Price");
        assertEq(usdSteth2Price, bs.getUsdTokenPriceFromExternal(token, 0), "usdSteth2Price");
        uint256 steth2UsdPrice = bs.getTokenUsdPrice(token);
        assertEq(steth2UsdPrice, 1000e6, "steth2UsdPrice");
        assertEq(steth2UsdPrice, bs.getTokenUsdPriceFromExternal(token, 0), "steth2UsdPrice");

        // twap math:
        // 1/1.5 + 1/1.4 + 1/1.3 + 1/1.2 + 1/1.1 + 1/1 = 4.8926073926 / 6 = 0.815434565434565
        uint256 usdSteth2Twap = bs.getUsdTokenTwap(token, 3600);
        assertEq(usdSteth2Twap, bs.getUsdTokenPriceFromExternal(token, 3600), "usdSteth2Twap");
        assertEq(usdSteth2Twap, 0.000815434565434565e18, "usdSteth2Twap");

        // 1.5 + 1.4 + 1.3 + 1.2 + 1.1 + 1 = 7.5 / 6 = 1.25e18
        uint256 steth2UsdTwap = bs.getTokenUsdTwap(token, 3600);
        assertEq(steth2UsdTwap, 1250e6, "steth2UsdTwap");
        assertEq(steth2UsdTwap, bs.getTokenUsdPriceFromExternal(token, 3600), "steth2UsdTwap");
    }

    function test_oracle_twap_equal() public {
        // add 6 rounds to the chainlink oracle, 10 minutes apart:
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 3600);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 3000);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1100e6, 2400);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 1800);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 900e6, 1200);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 600);

        // query price
        uint256 usdTokenPrice = OracleFacet(BEANSTALK).getUsdTokenTwap(C.WETH, 3600);
        uint256 tokenUsdPrice = OracleFacet(BEANSTALK).getTokenUsdTwap(C.WETH, 3600);

        // verify math:
        // 1200 + 1000 + 1100 + 1000 + 900 + 1200 = 6400 / 6 = 1066.666666e6
        // (1/1200 + 1/1000 + 1/1100 + 1/1000 + 1/900 + 1/1200) / 6 = 0.00947811447811447 * 1e18
        assertEq(tokenUsdPrice, 1066.666666e6);
        assertEq(usdTokenPrice, 0.000947811447811447e18);
    }

    function test_oracle_twap_diff() public {
        // add 6 rounds to the chainlink oracle such that 60 mins have elapsed
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 3600);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 3000);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1100e6, 2000);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 1500);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 900e6, 1200);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 50);

        // query price
        uint256 usdTokenPrice = OracleFacet(BEANSTALK).getUsdTokenTwap(C.WETH, 3600);
        uint256 tokenUsdPrice = OracleFacet(BEANSTALK).getTokenUsdTwap(C.WETH, 3600);

        // verify math:
        // (1200 * 600) + (1000 * 1000) + (1100 * 500) + (1000 * 300) + (900 * 1150) + (1200 * 50) / 3600 = 1018.055555 * 1e6
        // (1/1200 * 600) + (1/1000 * 1000) + (1/1100 * 500) + (1/1000 * 300) + (1/900 * 1150) + (1/1200 * 50) / 3600 = 0.000992774971941638 * 1e18
        assertEq(tokenUsdPrice, 1018.055555e6);
        assertEq(usdTokenPrice, 0.000992774971941638e18);
    }

    // oracle helpers:

    function initializeMockStakingEthToken() internal returns (address) {
        // create a new staking eth derivative.
        // create new mock chainlink aggergator for this token.
        MockChainlinkAggregator oracle = new MockChainlinkAggregator();
        oracle.setDecimals(18);
        uint256 price = 1.5e18;

        // add some mock rounds.
        for (uint lookback = 3600; lookback > 0; lookback -= 600) {
            mockAddRound(address(oracle), int256(price), lookback);
            price -= 0.1e18;
        }
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 5000);
        mockAddRound(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 900);

        // deploy new staking eth derivative.
        address token = address(new MockToken("StakingETH2", "stETH2"));

        // deploy new staking eth oracle contract
        address oracleAddress = address(
            new StakingEthChainlinkOracle(
                C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
                3600 * 4,
                address(oracle),
                3600 * 4,
                token
            )
        );

        // add oracle implementation to beanstalk:
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            token,
            IMockFBeanstalk.Implementation(
                oracleAddress,
                StakingEthChainlinkOracle.getPrice.selector,
                bytes1(0x00)
            )
        );
        return token;
    }
}
