/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

///////// MOCKS ////////
import {MockChainlinkAggregator} from "contracts/mocks/chainlink/MockChainlinkAggregator.sol";
import {MockUniswapV3Pool} from "contracts/mocks/uniswap/MockUniswapV3Pool.sol";
import {MockUniswapV3Factory} from "contracts/mocks/uniswap/MockUniswapV3Factory.sol";
import {IMockFBeanstalk} from "contracts/interfaces/IMockFBeanstalk.sol";
import {LSDChainlinkOracle} from "contracts/ecosystem/oracles/LSDChainlinkOracle.sol";

/**
 * @title OracleDeployer
 * @author Brean
 * @notice Test helper contract to deploy Depot.
 */
interface ChainlinkPriceFeedRegistry {
    function getFeed(address base, address quote) external view returns (address aggregator);
}

contract OracleDeployer is Utils {
    ////////// CHAINLINK //////////
    address constant USDC_USD_CHAINLINK_PRICE_AGGREGATOR =
        address(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);

    address constant WBTC_USD_CHAINLINK_PRICE_AGGREGATOR =
        address(0xd0C7101eACbB49F3deCcCc166d238410D6D46d57);

    address constant ETH_USD_CHAINLINK_PRICE_AGGREGATOR =
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR =
        0x86392dC19c0b719886221c78AB11eb8Cf5c52812;

    //////// UNISWAP ORACLES ////////
    address internal constant WSTETH_ETH_UNIV3_01_POOL = 0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa; // 0.01% pool

    // timeout for Oracles with a 1 hour heartbeat.
    uint256 constant FOUR_HOUR_TIMEOUT = 14400;
    // timeout for Oracles with a 1 day heartbeat.
    uint256 constant FOUR_DAY_TIMEOUT = 345600;

    // new chainlink oracles should be added here.
    address[] public chainlinkOracles = [
        ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
        WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
        USDC_USD_CHAINLINK_PRICE_AGGREGATOR,
        WBTC_USD_CHAINLINK_PRICE_AGGREGATOR
    ];

    // initial prices for chainlink oracles should be added here.
    // assumes index matching with chainlinkOracles.
    int256[] initalPrices = [
        int256(1000e6), // ETH/USD
        1e6, // wstETH/ETH
        1e6, // USDC/USD
        50000e6 // WBTC/USD
    ];

    ////////// UNISWAP //////////

    address constant WBTC_USDC_03_POOL = address(0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35);
    address constant AAVE_ETH_03_POOL = address(0x5aB53EE1d50eeF2C1DD3d5402789cd27bB52c1bB);
    address constant WSTETH_ETH_001_POOL = address(0x109830a1AAaD605BbF02a9dFA7B0B92EC2FB7dAa);
    // address constant WBTC = address(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    address constant AAVE = address(0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9);

    // new uniswap pools should be appended here.
    address[][] public pools = [
        [WSTETH_ETH_UNIV3_01_POOL, WSTETH, WETH], // wstETH/ETH
        [WBTC_USDC_03_POOL, WBTC, USDC] // WBTC/USDC
    ];

    // oracles must be initalized at some price. Assumes index matching with pools.
    uint256[][] public priceData = [[uint256(1e18), 18], [uint256(500e6), 8]];

    // new custom oracle implmenetations should be added here.
    address lsdChainlinkOracle; // LSD Chainlink Oracle

    /**
     * @notice initializes chainlink oracles.
     * @dev oracles are mocked, and thus require initalization/updates.
     */
    function initChainlink(bool verbose) internal {
        // optional labels to assist in testing.
        vm.label(ETH_USD_CHAINLINK_PRICE_AGGREGATOR, "CL ETH/USD");
        vm.label(WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR, "CL WstETH/ETH");
        vm.label(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6, "CL USDC/USD");
        vm.label(0x3E7d1eAB13ad0104d2750B8863b489D65364e32D, "CL USDT/USD");
        vm.label(WBTC_USD_CHAINLINK_PRICE_AGGREGATOR, "CL WBTC/USD");

        for (uint i; i < chainlinkOracles.length; i++) {
            deployCodeTo("MockChainlinkAggregator.sol", new bytes(0), chainlinkOracles[i]);
            MockChainlinkAggregator(chainlinkOracles[i]).setDecimals(6);
            if (verbose) console.log("Chainlink Oracle Deployed at:", chainlinkOracles[i]);

            mockAddRound(chainlinkOracles[i], initalPrices[i], 900);
        }
    }

    /**
     * @notice adds a round to a chainlink oracle.
     */
    function mockAddRound(address chainlinkOracle, int256 price, uint256 secondsAgo) internal {
        uint256 time;

        if (block.timestamp < secondsAgo) {
            time = 1; // min timestamp = 1.
        } else {
            time = block.timestamp - secondsAgo;
        }
        uint80 latestRound = MockChainlinkAggregator(chainlinkOracle).getLatestRoundId();
        MockChainlinkAggregator(chainlinkOracle).addRound(price, time, time, latestRound + 1);
    }

    /**
     * @notice adds an invalid round to a chainlink oracle.
     */
    function mockAddInvalidRound(address chainlinkOracle) internal {
        uint80 roundId = MockChainlinkAggregator(chainlinkOracle).getLatestRoundId();
        MockChainlinkAggregator(chainlinkOracle).addRound(0, 0, 0, roundId + 1);
    }

    /**
     * @notice adds a round to the chainlink oracle, using the last rounds data.
     * @dev adds 2 rounds. 1 Round that goes back 900 seconds,
     * and another that goes back 3600 + 900 seconds, due to how beanstalk calculates the twap.
     * the block.timestamp must be greater than 4500 seconds.
     */
    function updateChainlinkOracleWithPreviousData(address chainlinkOracle) internal {
        (, int256 answer, , , ) = MockChainlinkAggregator(chainlinkOracle).latestRoundData();
        mockAddRound(chainlinkOracle, answer, 4500);
        mockAddRound(chainlinkOracle, answer, 900);
    }

    /**
     * @notice initializes uniswap pools for testing.
     */
    function initUniswapPools(bool verbose) internal {
        vm.label(WSTETH_ETH_UNIV3_01_POOL, "UNI WSTETH_ETH_UNIV3_01");
        vm.label(WBTC_USDC_03_POOL, "UNI WBTC_USDC_03_POOL");

        MockUniswapV3Factory uniFactory = MockUniswapV3Factory(new MockUniswapV3Factory());

        for (uint i; i < pools.length; i++) {
            address[] memory poolData = pools[i];
            address pool = uniFactory.createPool(poolData[1], poolData[2], 100);
            vm.etch(poolData[0], pool.code);
            if (verbose) console.log("Uniswap Oracle Deployed at:", poolData[0]);
            uint256 price = calcPrice(priceData[i][0], priceData[i][1]);
            MockUniswapV3Pool(poolData[0]).setOraclePrice(price, uint8(priceData[i][1]));
            if (verbose) console.log("Price set at:", priceData[i][0]);
            MockUniswapV3Pool(poolData[0]).setToken0(poolData[1]);
            MockUniswapV3Pool(poolData[0]).setToken1(poolData[2]);
        }
    }

    /**
     * @notice calculates the price for a uniswap pool.
     * @dev will need to be updated for different pools w/different decimals.
     */
    function calcPrice(uint256 _price, uint256 decimal) internal pure returns (uint256 price) {
        uint x;
        if (decimal == 6) {
            x = 1e18;
        } else if (decimal == 18) {
            x = 1e36;
        } else if (decimal == 8) {
            x = 1e14;
        }
        price = x / (_price + 1);
    }

    function initWhitelistOracles(bool verbose) internal {
        // deploy LSD Chainlink Oracle
        lsdChainlinkOracle = address(new LSDChainlinkOracle());
        vm.label(lsdChainlinkOracle, "LSD Chainlink Oracle");
        // new custom oracles should be added here.

        // init ETH:USD oracle
        updateOracleImplementationForTokenUsingChainlinkAggregator(
            WETH,
            ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
            verbose
        );

        // init L1 ETH:USD oracle
        updateOracleImplementationForTokenUsingChainlinkAggregator(
            L1_WETH,
            ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
            verbose
        );

        // init wsteth oracle.
        setupLSDChainlinkOracleForToken(
            WSTETH,
            WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR,
            FOUR_HOUR_TIMEOUT
        );
    }

    function updateOracleImplementationForTokenUsingChainlinkAggregator(
        address token,
        address oracleAddress,
        bool verbose
    ) internal {
        IMockFBeanstalk.Implementation memory oracleImplementation = IMockFBeanstalk.Implementation(
            oracleAddress,
            bytes4(0),
            bytes1(0x01),
            abi.encode(FOUR_HOUR_TIMEOUT)
        );

        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(token, oracleImplementation);

        if (verbose)
            console.log("Updated oracle implementation for token: ", token, " to: ", oracleAddress);
    }

    function setupLSDChainlinkOracleForToken(
        address token,
        address tokenChainlinkOracle,
        uint256 tokenTimeout
    ) internal {
        address _ethChainlinkOracle = ETH_USD_CHAINLINK_PRICE_AGGREGATOR;
        uint256 _ethTimeout = 3600 * 4;
        vm.prank(BEANSTALK);
        bs.updateOracleImplementationForToken(
            token,
            IMockFBeanstalk.Implementation(
                lsdChainlinkOracle,
                LSDChainlinkOracle.getPrice.selector,
                bytes1(0x00),
                abi.encode(
                    _ethChainlinkOracle,
                    _ethTimeout,
                    tokenChainlinkOracle,
                    tokenTimeout,
                    token
                )
            )
        );
    }
}
