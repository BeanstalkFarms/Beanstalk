/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";
import {C} from "contracts/C.sol";

///////// MOCKS ////////
import {MockChainlinkAggregator} from "contracts/mocks/chainlink/MockChainlinkAggregator.sol";
import {MockUniswapV3Pool} from "contracts/mocks/uniswap/MockUniswapV3Pool.sol";
import {MockUniswapV3Factory} from "contracts/mocks/uniswap/MockUniswapV3Factory.sol";

/**
 * @title OracleDeployer
 * @author Brean
 * @notice Test helper contract to deploy Depot.
 */
contract OracleDeployer is Utils {

    ////////// CHAINLINK //////////

    // new chainlink oracles should be added here.
    address[] public chainlinkOracles = [
        C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR,
        C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR
    ];

    // inital prices for chainlink oracles should be added here.
    // assumes index matching with chainlinkOracles.
    int256[] initalPrices = [
        int256(1000e6), // ETH/USD
        1e6 // wstETH/ETH
    ];

    ////////// UNISWAP //////////

    // new uniswap pools should be appended here.
    address[][] public pools = [
        [C.WSTETH_ETH_UNIV3_01_POOL, C.WSTETH, C.WETH] // wstETH/ETH
    ];

    // oracles must be initalized at some price. Assumes index matching with pools.
    uint256[][] public priceData = [
        [1e18, 18]
    ];

    /**
     * @notice initializes chainlink oracles.
     * @dev oracles are mocked, and thus require initalization/updates.
     */
    function initChainlink(bool verbose) internal {
        // optional labels to assist in testing. 
        vm.label(C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, "CL ETH/USD");
        vm.label(C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR, "CL WstETH/ETH");

        for(uint i; i < chainlinkOracles.length; i++) {
            deployCodeTo("MockChainlinkAggregator.sol", new bytes(0), chainlinkOracles[i]);
            MockChainlinkAggregator(chainlinkOracles[i]).setDecimals(6);
            if (verbose) console.log("Chainlink Oracle Deployed at:", chainlinkOracles[i]);
            
            mockAddRound(chainlinkOracles[i], initalPrices[i], 900);
        }
    }


    /**
     * @notice adds a round to a chainlink oracle.
     */
    function mockAddRound(
        address chainlinkOracle,
        int256 price,
        uint256 secondsAgo
    ) internal {
        uint256 time;

        if(block.timestamp < secondsAgo) {
            time = 1; // min timestamp = 1.
        } else { 
            time = block.timestamp - secondsAgo;
        }
        uint80 latestRound = MockChainlinkAggregator(chainlinkOracle).getLatestRoundId();
        MockChainlinkAggregator(chainlinkOracle).addRound(
            price,
            time, 
            time, 
            latestRound + 1
        );
    }

    /**
     * @notice adds an invalid round to a chainlink oracle.
     */
    function mockAddInvalidRound(address chainlinkOracle) internal {
        uint80 roundId =  MockChainlinkAggregator(chainlinkOracle).getLatestRoundId();
        MockChainlinkAggregator(chainlinkOracle).addRound(0, 0, 0, roundId + 1);
    }

    /**
     * @notice adds a round to the chainlink oracle, using the last rounds data.
     * @dev adds 2 rounds. 1 Round that goes back 900 seconds, 
     * and another that goes back 3600 + 900 seconds, due to how beanstalk calculates the twap.
     * the block.timestamp must be greater than 4500 seconds.
     */
    function updateChainlinkOracleWithPreviousData(address chainlinkOracle) internal {
        (, int256 answer,,,) = MockChainlinkAggregator(chainlinkOracle).latestRoundData();
        mockAddRound(chainlinkOracle, answer, 4500);
        mockAddRound(chainlinkOracle, answer, 900);
    }

    /**
     * @notice initializes uniswap pools for testing.
     */
    function initUniswapPools(bool verbose) internal {

        vm.label(C.WSTETH_ETH_UNIV3_01_POOL, "UNI WSTETH_ETH_UNIV3_01");

        MockUniswapV3Factory uniFactory = MockUniswapV3Factory(new MockUniswapV3Factory());
        
        for(uint i; i < pools.length; i++) {
            address[] memory poolData = pools[i];
            address pool = uniFactory.createPool(poolData[1], poolData[2], 100);
            vm.etch(poolData[0], getBytecodeAt(pool));
            if (verbose) console.log("Uniswap Oracle Deployed at:", poolData[0]);
            uint256 price = calcPrice(priceData[i][0], priceData[i][1]);
            MockUniswapV3Pool(poolData[0]).setOraclePrice(price, uint8(priceData[i][1]));
            if (verbose) console.log("Price set at:", priceData[i][0]);
        }
    }

    /**
     * @notice calculates the price for a uniswap pool.
     * @dev will need to be updated for different pools w/different decimals.
     */
    function calcPrice(uint256 _price, uint256 decimal) internal pure returns (uint256 price) {
        uint x;
        if(decimal == 6) {
            x = 1e18;
        } else if (decimal == 18) { 
            x = 1e36;
        }
        price = x / (_price + 1);
    }
}
