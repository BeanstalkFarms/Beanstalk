/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";
import {Utils} from "test/foundry/utils/Utils.sol";
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

    /**
     * @notice initializes chainlink oracles.
     * @dev oracles are mocked, and thus require initalization/updates.
     */
    function initChainlink() public {
        // new chainlink oracles should be appended here.
        address[2] memory oracles = [
            C.ETH_USD_CHAINLINK_PRICE_AGGREGATOR, // ETH/USD
            C.WSTETH_ETH_CHAINLINK_PRICE_AGGREGATOR // wstETH/ETH
        ];

        // price to initalize at. Assumes index matching with oracles.
        int256[2] memory initalPrices = [
            int256(1000e6), // ETH/USD
            1e18 // wstETH/ETH
        ];
        
        for(uint i; i < oracles.length; i++) {
            deployCodeTo("MockChainlinkAggregator.sol", new bytes(0), oracles[i]);
            console.log("Chainlink Oracle Deployed at:", oracles[i]);
            mockAddRound(oracles[i], initalPrices[i], 900);
        }
    }


    /**
     * @notice adds a round to a chainlink oracle.
     */
    function mockAddRound(
        address chainlinkOracle,
        int256 price,
        uint256 secondsAgo
    ) public {
        MockChainlinkAggregator(chainlinkOracle).addRound(
            price,
            block.timestamp - secondsAgo, 
            block.timestamp - secondsAgo, 
            1
        );
    }

    /**
     * @notice initializes uniswap pools for testing.
     */
    function initUniswapPools() internal {

        MockUniswapV3Factory uniFactory = MockUniswapV3Factory(new MockUniswapV3Factory());
        
        // new pools should be appended here.
        address[3][1] memory pools = [
            [C.WSTETH, C.WETH, C.WSTETH_ETH_UNIV3_01_POOL] // wstETH/ETH
        ];

        // oracles must be initalized at some price. Assumes index matching with pools.
        uint256[2][1] memory priceData = [
            [uint256(1e18), 18]
        ];
        for(uint i; i < pools.length; i++) {
            address[3] memory poolData = pools[i];
            address pool = uniFactory.createPool(poolData[0], poolData[1], 100);
            vm.etch(poolData[2], getBytecodeAt(pool));
            MockUniswapV3Pool(poolData[2]).setOraclePrice(priceData[i][0], uint8(priceData[i][1]));
        }
    }
}
