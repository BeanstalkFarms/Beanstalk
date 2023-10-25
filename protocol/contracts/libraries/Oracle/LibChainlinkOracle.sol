/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {IChainlinkAggregator} from "contracts/interfaces/chainlink/IChainlinkAggregator.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Chainlink Oracle Library
 * @notice Contains functionalty to fetch prices from Chainlink price feeds.
 * @dev currently supports:
 * - ETH/USD price feed
 **/
library LibChainlinkOracle {
    using SafeMath for uint256;

    // Uses the same timeout as Liquity's Chainlink timeout.
    uint256 public constant CHAINLINK_TIMEOUT = 14400; // 4 hours: 60 * 60 * 4

    IChainlinkAggregator constant priceAggregator = IChainlinkAggregator(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    uint256 constant PRECISION = 1e6; // use 6 decimal precision.

    /**
     * @dev Returns the most recently reported ETH/USD price from the Chainlink Oracle.
     * Return value has 6 decimal precision.
     * Returns 0 if Chainlink's price feed is broken or frozen.
     **/
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
        try priceAggregator.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        ) {
            // Check for an invalid roundId that is 0
            if (roundId == 0) return 0;
            if (checkForInvalidTimestampOrAnswer(timestamp, answer)) {
                return 0;
            }
            // Adjust to 6 decimal precision.
            return uint256(answer).mul(PRECISION).div(10 ** decimals);
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }
    }

    /**
     * @dev Returns the TWAP ETH/USD price from the Chainlink Oracle over the past `lookback` seconds.
     * Return value has 6 decimal precision.
     * Returns 0 if Chainlink's price feed is broken or frozen.
     * Supports a maximum lookback of 4 hours.
     **/
    function getEthUsdTwap(uint256 lookback) internal view returns (uint256 price) {
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
        try priceAggregator.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        ) {
            // Check for an invalid roundId that is 0
            if (roundId == 0) return 0;
            if (checkForInvalidTimestampOrAnswer(timestamp, answer)) {
                return 0;
            }

            uint256 endTimestamp = block.timestamp.sub(lookback);
            // Check if last round was more than `lookback` ago.
            if (timestamp <= endTimestamp) {
                return uint256(answer).mul(PRECISION).div(10 ** decimals);
            } else {
                uint256 cumulativePrice;
                uint256 lastTimestamp = block.timestamp;
                // Loop through previous rounds and compute cumulative sum until
                // a round at least `lookback` seconds ago is reached.
                while (timestamp > endTimestamp) {
                    cumulativePrice = cumulativePrice.add(uint256(answer).mul(lastTimestamp.sub(timestamp)));
                    roundId -= 1;
                    try priceAggregator.getRoundData(roundId) returns (
                        uint80 /* roundId */,
                        int256 _answer,
                        uint256 /* startedAt */,
                        uint256 _timestamp,
                        uint80 /* answeredInRound */
                    ) {
                        if (checkForInvalidTimestampOrAnswer(_timestamp, _answer)) {
                            return 0;
                        }
                        lastTimestamp = timestamp;
                        timestamp = _timestamp;
                        answer = _answer;
                    } catch {
                        // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
                        return 0;
                    }
                }
                cumulativePrice = cumulativePrice.add(uint256(answer).mul(lastTimestamp.sub(endTimestamp)));
                return cumulativePrice.mul(PRECISION).div(10 ** decimals).div(lookback);
            }
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }
    }

    function checkForInvalidTimestampOrAnswer(uint256 timestamp, int256 answer) private view returns (bool) {
        // Check for an invalid timeStamp that is 0, or in the future
        if (timestamp == 0 || timestamp > block.timestamp) return true;
        // Check if Chainlink's price feed has timed out
        if (block.timestamp.sub(timestamp) > CHAINLINK_TIMEOUT) return true;
        // Check for non-positive price
        if (answer <= 0) return true;
    }
}
