/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// import {OracleLibrary} from "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

/**
 * @author Publius
 * @title Oracle fetches the eth usd price
 **/


library LibEthUsdOracle {

    // AggregatorV3Interface constant priceAggregator = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

    // function getCurrentChainlinkResponse() internal view returns (ChainlinkResponse memory chainlinkResponse) {
    //     // First, try to get current decimal precision:
    //     try priceAggregator.decimals() returns (uint8 decimals) {
    //         // If call to Chainlink succeeds, record the current decimal precision
    //         chainlinkResponse.decimals = decimals;
    //     } catch {
    //         // If call to Chainlink aggregator reverts, return a zero response with success = false
    //         return chainlinkResponse;
    //     }

    //     // Secondly, try to get latest price data:
    //     try priceAggregator.latestRoundData() returns
    //     (
    //         uint80 roundId,
    //         int256 answer,
    //         uint256 /* startedAt */,
    //         uint256 timestamp,
    //         uint80 /* answeredInRound */
    //     )
    //     {
    //         // If call to Chainlink succeeds, return the response and success = true
    //         chainlinkResponse.roundId = roundId;
    //         chainlinkResponse.answer = answer;
    //         chainlinkResponse.timestamp = timestamp;
    //         chainlinkResponse.success = true;
    //         return chainlinkResponse;
    //     } catch {
    //         // If call to Chainlink aggregator reverts, return a zero response with success = false
    //         return chainlinkResponse;
    //     }
    // }
}
