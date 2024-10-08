// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;
pragma abicoder v2;

import {TestHelper, LibTransfer, C, IMockFBeanstalk} from "test/foundry/utils/TestHelper.sol";
import {OracleFacet} from "contracts/beanstalk/sun/OracleFacet.sol";
import {MockChainlinkAggregator} from "contracts/mocks/chainlink/MockChainlinkAggregator.sol";
import {MockToken} from "contracts/mocks/MockToken.sol";
import {LSDChainlinkOracle} from "contracts/ecosystem/oracles/LSDChainlinkOracle.sol";
import {LibChainlinkOracle} from "contracts/libraries/Oracle/LibChainlinkOracle.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWell} from "contracts/interfaces/basin/IWell.sol";
import "forge-std/console.sol";

/**
 * @notice Tests the functionality of the Oracles.
 */
contract OracleTest is TestHelper {
    function setUp() public {
        initializeBeanstalkTestState(true, false);
    }

    function testUniswapOracleImplementation() public {
        // encode type 0x01
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                WBTC_USD_CHAINLINK_PRICE_AGGREGATOR,
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );
        uint256 price = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC);
        assertEq(price, 0.00002e8, "price using encode type 0x01");

        setupUniswapWBTCOracleImplementation();

        price = OracleFacet(BEANSTALK).getTokenUsdPrice(WBTC);
        // 1 USDC will get ~500 satoshis of BTC at $50k
        // 1 USDC = 1e6
        // 1 wBTC = 1e8
        // $50,000/100000000*1000000 = 500
        // function returns uint256(1e24).div(tokenPrice);
        // expected delta is 0.2004008016032064%
        assertApproxEqRel(price, 50000e6, 0.001e18, "price using encode type 0x02");
    }

    function test_uniswap_external() public {
        setupUniswapWBTCOracleImplementation();

        // exercise TokenUsd price and UsdToken price
        uint256 tokenUsdPriceFromExternal = OracleFacet(BEANSTALK).getTokenUsdPriceFromExternal(
            WBTC,
            0
        );
        assertApproxEqRel(
            tokenUsdPriceFromExternal,
            50000e6,
            0.001e18,
            "tokenUsdPriceFromExternal"
        );

        uint256 usdTokenPriceFromExternal = OracleFacet(BEANSTALK).getUsdTokenPriceFromExternal(
            WBTC,
            0
        );
        assertEq(usdTokenPriceFromExternal, 0.00002e8, "usdTokenPriceFromExternal"); // e8 because wbtc has 8 decimals
    }

    /**
     * @notice verifies functionality with LSDChainlinkOracle.sol.
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
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 3600);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 3000);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1100e6, 2400);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 1800);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 900e6, 1200);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 600);

        // query price
        uint256 usdTokenPrice = OracleFacet(BEANSTALK).getUsdTokenTwap(WETH, 3600);
        uint256 tokenUsdPrice = OracleFacet(BEANSTALK).getTokenUsdTwap(WETH, 3600);

        // verify math:
        // 1200 + 1000 + 1100 + 1000 + 900 + 1200 = 6400 / 6 = 1066.666666e6
        // (1/1200 + 1/1000 + 1/1100 + 1/1000 + 1/900 + 1/1200) / 6 = 0.00947811447811447 * 1e18
        assertEq(tokenUsdPrice, 1066.666666e6);
        assertEq(usdTokenPrice, 0.000947811447811447e18);
    }

    function test_oracle_twap_diff() public {
        // add 6 rounds to the chainlink oracle such that 60 mins have elapsed
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 3600);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 3000);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1100e6, 2000);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 1500);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 900e6, 1200);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1200e6, 50);

        // query price
        uint256 usdTokenPrice = OracleFacet(BEANSTALK).getUsdTokenTwap(WETH, 3600);
        uint256 tokenUsdPrice = OracleFacet(BEANSTALK).getTokenUsdTwap(WETH, 3600);

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
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 5000);
        mockAddRound(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, 1000e6, 900);

        // deploy new staking eth derivative.
        address token = address(new MockToken("StakingETH2", "stETH2"));

        // add oracle implementation to beanstalk:
        setupLSDChainlinkOracleForToken(
            token, // staking eth 2
            address(oracle), // mock chainlink aggregator
            3600 * 4 // 4 hours
        );
        return token;
    }

    function testLSDChainlinkOracleDecodesDataCorrectly() public {
        MockChainlinkAggregator oracle = new MockChainlinkAggregator();
        LSDChainlinkOracle deployedOracle = new LSDChainlinkOracle();
        address someToken = address(new MockToken("StakingETH2", "stETH2"));

        address _ethChainlinkOracle = ETH_USD_CHAINLINK_PRICE_AGGREGATOR;
        uint256 _ethTimeout = 3600 * 4;
        address _xEthChainlinkOracle = address(oracle);
        uint256 _xEthTimeout = 3600 * 4;
        address _token = someToken;

        bytes memory data = abi.encode(
            _ethChainlinkOracle,
            _ethTimeout,
            _xEthChainlinkOracle,
            _xEthTimeout
        );

        (
            address ethChainlinkOracle,
            uint256 ethTimeout,
            address xEthChainlinkOracle,
            uint256 xEthTimeout
        ) = deployedOracle.decodeData(data);

        assertEq(ethChainlinkOracle, _ethChainlinkOracle);
        assertEq(ethTimeout, _ethTimeout);
        assertEq(xEthChainlinkOracle, _xEthChainlinkOracle);
        assertEq(xEthTimeout, _xEthTimeout);
    }

    function testExternalOracleImplementation() public {
        // setup oracle implementation
        address oracle = address(new ExternalOracleTester());
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                oracle,
                ExternalOracleTester.getPrice.selector,
                bytes1(0x00), // 0x00 is external
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );

        uint256 tokenPriceWBTC = OracleFacet(BEANSTALK).getTokenUsdPrice(WBTC); // should be 50000e6
        assertEq(tokenPriceWBTC, 50000e6, "getTokenUsdPrice wbtc");

        // also exercise getMillionUsdPrice
        uint256 tokenPriceWBTCMillion = OracleFacet(BEANSTALK).getMillionUsdPrice(WBTC, 0);
        assertEq(tokenPriceWBTCMillion, 50000e12, "getMillionUsdPrice wbtc");
    }

    function testGetOracleImplementationForToken() public {
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                WBTC_USD_CHAINLINK_PRICE_AGGREGATOR,
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );

        IMockFBeanstalk.Implementation memory oracleImplementation = bs
            .getOracleImplementationForToken(WBTC);
        assertEq(oracleImplementation.target, WBTC_USD_CHAINLINK_PRICE_AGGREGATOR);
    }

    function testZeroAddressOracleImplementationTarget() public {
        vm.prank(BEANSTALK);
        // exersizes address 0 and bytes 0x00, although there's no current way to whitelist something with these values.
        vm.expectRevert("Whitelist: Invalid Target Address");
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                address(0),
                IMockFBeanstalk.getUsdTokenPriceFromExternal.selector,
                bytes1(0x00),
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );
    }

    function testGetTokenPrice() public {
        // change encode type to 0x02 for wbtc:
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                WBTC_USD_CHAINLINK_PRICE_AGGREGATOR,
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );

        // token price is number of dollars per token, i.e. 50000 USD for 1 WBTC
        uint256 tokenPriceEth = OracleFacet(BEANSTALK).getTokenUsdPrice(WETH); // 1000e6
        assertEq(tokenPriceEth, 1000e6, "getTokenUsdPrice eth");

        // number of tokens received per dollar
        uint256 usdPriceEth = OracleFacet(BEANSTALK).getUsdTokenPrice(WETH); // 1e15 which is 1e18 (1 eth in wei) / 1000 (weth price 1000), you get 1/1000th of 1 eth for $1
        assertEq(usdPriceEth, 1e18 / 1000, "getUsdTokenPrice eth");

        uint256 tokenPriceWBTC = OracleFacet(BEANSTALK).getTokenUsdPrice(WBTC); // should be 50000e6
        assertEq(tokenPriceWBTC, 50000e6, "getTokenUsdPrice wbtc");

        // number of tokens received per dollar
        uint256 usdPriceWBTC = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC); // $1 = 0.00002 wbtc, wbtc is 8 decimals,
        assertEq(usdPriceWBTC, 0.00002e8, "getUsdTokenPrice wbtc");
    }

    // test provided by T1MOH
    function test_getUsdTokenPrice_whenExternalToken_priceIsInvalid() public {
        // pre condition: encode type 0x01
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                WBTC_USD_CHAINLINK_PRICE_AGGREGATOR,
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_HOUR_TIMEOUT)
            )
        );

        // WETH price is 1000
        uint256 priceWETH = OracleFacet(BEANSTALK).getUsdTokenPrice(WETH);
        assertEq(priceWETH, 1e15); //  1e18/1e3 = 1e15

        // WBTC price is 50000
        uint256 priceWBTC = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC);
        assertEq(priceWBTC, 0.00002e8); // adjusted to 8 decimals
    }

    function testForkMainnetWBTCOracle() public {
        forkMainnetAndUpgradeAllFacets(20641000);

        setupUniswapWBTCOracleImplementation();

        uint256 priceWBTCmillion = OracleFacet(BEANSTALK).getMillionUsdPrice(WBTC, 0);
        // 1e(8+6)/1684341342 = 59370.3885943091
        assertEq(priceWBTCmillion, 1684454192); // $1,000,000 buys 1684341342 at BTC price of 6148186669379 per USDC and USDC 99993272.

        // 1e8/1684 = 59382.4228028504
        uint256 priceWBTC = OracleFacet(BEANSTALK).getUsdTokenPrice(WBTC);
        assertEq(priceWBTC, 1684); // $1 buys 1683 satoshi at BTC price of 6148186669379 per USDC and USDC 99993272.
    }

    function testForkMainnetAAVEOracle() public {
        forkMainnetAndUpgradeAllFacets(20666000);

        setupUniswapAaveOracleImplementation();

        uint256 priceAAVE = OracleFacet(BEANSTALK).getUsdTokenPrice(AAVE);
        assertEq(priceAAVE, 7478751606516229);
        // chainlink price: 2541090000 (2541 usd per weth at 6 decimals)
        // uniswap price: 52620 (0.052620 WETH per AAVE at 6 decimals)
        // these multiplied together: 133712155800000 (12 decimal precision)
        // but inverse is needed, so 1e12/133712155800000 = 0.007478751607
        // and 0.007478751607 at 6 decimal precision is 7479
    }

    function testForkMainnetWSTETHOracle() public {
        forkMainnetAndUpgradeAllFacets(20666000);

        setupUniswapWstethOracleImplementation();

        uint256 priceWSTETH = OracleFacet(BEANSTALK).getUsdTokenPrice(WSTETH);
        assertEq(priceWSTETH, 334243752683826);
    }

    function testForkMainnetWBTCDeltaB() public {
        forkMainnetAndUpgradeAllFacets(20666000);

        setupUniswapWBTCOracleImplementation();

        console.log("deploy well");

        // deploy a wbtc:bean well
        deployWBTCWellOnFork(true, true);
        console.log("deployed well");

        address WBTC_WHALE = 0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8;
        // deal didn't seem to work with wbtc, so instead, transfer from a wbtc whale

        vm.prank(WBTC_WHALE);
        IERC20(WBTC).transfer(BEAN_WBTC_WELL, 2e8); // 2 wbtc
        deal(address(BEAN), BEAN_WBTC_WELL, 117989199462, true); // approx 2 btc worth of beans
        IWell(BEAN_WBTC_WELL).sync(users[0], 0);

        // mock init state so that the bean token is defined
        IMockFBeanstalk(BEANSTALK).mockInitState();

        int256 deltaB = IMockFBeanstalk(BEANSTALK).poolCurrentDeltaBMock(BEAN_WBTC_WELL);
        assertEq(deltaB, 0);
    }

    //////////// Helper Functions ////////////

    function setupUniswapWBTCOracleImplementation() public {
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WBTC,
            IMockFBeanstalk.Implementation(
                WBTC_USDC_03_POOL,
                bytes4(0),
                bytes1(0x02),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );

        // also uniswap relies on having a chainlink oracle for the dollar-denominated token, in this case USDC
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            USDC,
            IMockFBeanstalk.Implementation(
                USDC_USD_CHAINLINK_PRICE_AGGREGATOR,
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );
    }

    // AAVE:WETH is the highest volume non-memcoin/non-stablecoin pair on uniswap as of the time of writing
    function setupUniswapAaveOracleImplementation() internal {
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            AAVE,
            IMockFBeanstalk.Implementation(
                AAVE_ETH_03_POOL,
                bytes4(0),
                bytes1(0x02),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );

        // also uniswap relies on having a chainlink oracle for the token that's trading against the uniswap target token
        // in the case of AAVE/ETH, eth is the token that needs to be looked up against chainlink
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            L1_WETH,
            IMockFBeanstalk.Implementation(
                ETH_USD_CHAINLINK_PRICE_AGGREGATOR, // note this is using eth instead of weth
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );
    }

    function setupUniswapWstethOracleImplementation() internal {
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            WSTETH,
            IMockFBeanstalk.Implementation(
                WSTETH_ETH_001_POOL,
                bytes4(0),
                bytes1(0x02),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );

        // also uniswap relies on having a chainlink oracle for the token that's trading against the uniswap target token
        // in the case of AAVE/ETH, eth is the token that needs to be looked up against chainlink
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            L1_WETH,
            IMockFBeanstalk.Implementation(
                ETH_USD_CHAINLINK_PRICE_AGGREGATOR, // note this is using eth instead of weth
                bytes4(0),
                bytes1(0x01),
                abi.encode(LibChainlinkOracle.FOUR_DAY_TIMEOUT)
            )
        );
    }
}

contract ExternalOracleTester {
    function getPrice(
        uint256 tokenDecimals,
        uint256 lookback,
        bytes memory data
    ) external view returns (uint256) {
        uint256 timeout;
        bool isMillion = false;

        if (data.length > 32) {
            assembly {
                timeout := mload(add(data, 32))
                isMillion := byte(0, mload(add(data, 64)))
            }
        } else if (data.length == 32) {
            // only timeout supplied
            (timeout) = abi.decode(data, (uint256));
        }

        if (isMillion) {
            return 50000e12;
        }
        return 50000e6;
    }
}
