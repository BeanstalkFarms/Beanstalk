/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {IChainlinkAggregator} from "contracts/interfaces/chainlink/IChainlinkAggregator.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @author Publius
 * @title Oracle fetches the eth usd price
 **/


library LibChainlinkOracle {

    using SafeMath for uint256;

    IChainlinkAggregator constant priceAggregator = IChainlinkAggregator(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    uint256 constant PRECISION = 1e6; // use 6 decimal precision.

    function getEthUsdPrice() internal view returns (uint256 price) {
        // First, try to get current decimal precision:
        uint8 decimals;
        try priceAggregator.decimals() returns (uint8 _decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            decimals = _decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }

        // Secondly, try to get latest price data:
        try priceAggregator.latestRoundData() returns
        (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        )
        {
            // Check for an invalid roundId that is 0
            if (roundId == 0) return 0;
            // Check for an invalid timeStamp that is 0, or in the future
            if (timestamp == 0 || timestamp > block.timestamp) return 0;
            // TODO: Check if chainlink oracle expired
            // Check for non-positive price
            if (answer <= 0) return 0;
            // Return the 
            return uint256(answer).mul(PRECISION).div(10**decimals);
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }
    }
}
