/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {IChainlinkAggregator} from "contracts/interfaces/chainlink/IChainlinkAggregator.sol";
import {LibRedundantMath256} from "contracts/libraries/LibRedundantMath256.sol";
import "forge-std/console.sol";

/**
 * @title Chainlink Oracle Library
 * @notice Contains functionalty to fetch prices from Chainlink price feeds.
 * @dev currently supports:
 * - ETH/USD price feed
 **/
library LibChainlinkOracle {
    using LibRedundantMath256 for uint256;

    uint256 constant PRECISION = 1e6; // use 6 decimal precision.

    // timeout for Oracles with a 1 hour heartbeat.
    uint256 constant FOUR_HOUR_TIMEOUT = 14400;
    // timeout for Oracles with a 1 day heartbeat.
    uint256 constant FOUR_DAY_TIMEOUT = 345600;

    struct TwapVariables {
        uint256 cumulativePrice;
        uint256 endTimestamp;
        uint256 lastTimestamp;
    }

    /**
     * @dev Returns the TOKEN1/TOKEN2, or TOKEN2/TOKEN1 price with the option of using a TWA lookback.
     * Use `lookback = 0` for the instantaneous price. `lookback > 0` for a TWAP.
     * Use `tokenDecimals = 0` for TOKEN1/TOKEN2 price. `tokenDecimals > 0` for TOKEN2/TOKEN1 price.
     * Return value has 6 decimal precision if using TOKEN1/TOKEN2, and `tokenDecimals` if using TOKEN2/TOKEN1.
     * Returns 0 if `priceAggregatorAddress` is broken or frozen.
     **/
    function getTokenPrice(
        address priceAggregatorAddress,
        uint256 maxTimeout,
        uint256 tokenDecimals,
        uint256 lookback
    ) internal view returns (uint256 price) {
        return
            lookback > 0
                ? getTwap(priceAggregatorAddress, maxTimeout, tokenDecimals, lookback)
                : getPrice(priceAggregatorAddress, maxTimeout, tokenDecimals);
    }

    /**
     * @dev Returns the price of a given `priceAggregator`
     * Use `tokenDecimals = 0` for TOKEN1/TOKEN2 price. `tokenDecimals > 0` for TOKEN2/TOKEN1 price
     * where TOKEN1 is the numerator asset and TOKEN2 is the asset the oracle is denominated in.
     * Return value has 6 decimal precision if using TOKEN1/TOKEN2, and `tokenDecimals` if using TOKEN2/TOKEN1.
     * Returns 0 if Chainlink's price feed is broken or frozen.
     **/
    function getPrice(
        address priceAggregatorAddress,
        uint256 maxTimeout,
        uint256 tokenDecimals
    ) internal view returns (uint256 price) {
        IChainlinkAggregator priceAggregator = IChainlinkAggregator(priceAggregatorAddress);
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
            if (checkForInvalidTimestampOrAnswer(timestamp, answer, block.timestamp, maxTimeout)) {
                console.log("HIT INVALID TIMESTAMP OR ANSWER, RETURNING 0 FOR PRICE");
                return 0;
            }

            // if token decimals is greater than 0, return the TOKEN2/TOKEN1 price instead (i.e invert the price).
            if (tokenDecimals > 0) {
                price = uint256(10 ** (tokenDecimals + decimals)).div(uint256(answer));
            } else {
                // Adjust to 6 decimal precision.
                price = uint256(answer).mul(PRECISION).div(10 ** decimals);
            }
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }
    }

    /**
     * @dev Returns the TWAP price from the Chainlink Oracle over the past `lookback` seconds.
     * Use `tokenDecimals = 0` for TOKEN1/TOKEN2 price. `tokenDecimals > 0` for TOKEN2/TOKEN1 price.
     * Return value has 6 decimal precision if using TOKEN1/TOKEN2, and `tokenDecimals` if using TOKEN2/TOKEN1.
     * Returns 0 if Chainlink's price feed is broken or frozen.
     **/
    function getTwap(
        address priceAggregatorAddress,
        uint256 maxTimeout,
        uint256 tokenDecimals,
        uint256 lookback
    ) internal view returns (uint256 price) {
        IChainlinkAggregator priceAggregator = IChainlinkAggregator(priceAggregatorAddress);
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
            if (checkForInvalidTimestampOrAnswer(timestamp, answer, block.timestamp, maxTimeout)) {
                return 0;
            }

            TwapVariables memory t;

            t.endTimestamp = block.timestamp.sub(lookback);
            // Check if last round was more than `lookback` ago.
            if (timestamp <= t.endTimestamp) {
                if (tokenDecimals > 0) {
                    return uint256(10 ** (tokenDecimals + decimals)).div(uint256(answer));
                } else {
                    // Adjust to 6 decimal precision.
                    return uint256(answer).mul(PRECISION).div(10 ** decimals);
                }
            } else {
                t.lastTimestamp = block.timestamp;
                // Loop through previous rounds and compute cumulative sum until
                // a round at least `lookback` seconds ago is reached.
                while (timestamp > t.endTimestamp) {
                    // if token decimals is greater than 0, return the TOKEN2/TOKEN1 price instead (i.e invert the price).
                    if (tokenDecimals > 0) {
                        answer = int256((10 ** (tokenDecimals + decimals)) / (uint256(answer)));
                    }
                    t.cumulativePrice = t.cumulativePrice.add(
                        uint256(answer).mul(t.lastTimestamp.sub(timestamp))
                    );
                    roundId -= 1;
                    t.lastTimestamp = timestamp;
                    (answer, timestamp) = getRoundData(priceAggregator, roundId);
                    if (
                        checkForInvalidTimestampOrAnswer(
                            timestamp,
                            answer,
                            t.lastTimestamp,
                            maxTimeout
                        )
                    ) {
                        return 0;
                    }
                }
                if (tokenDecimals > 0) {
                    answer = int256((10 ** (tokenDecimals + decimals)) / (uint256(answer)));
                }
                t.cumulativePrice = t.cumulativePrice.add(
                    uint256(answer).mul(t.lastTimestamp.sub(t.endTimestamp))
                );
                if (tokenDecimals > 0) {
                    price = t.cumulativePrice.div(lookback);
                } else {
                    price = t.cumulativePrice.mul(PRECISION).div(10 ** decimals).div(lookback);
                }
            }
        } catch {
            // If call to Chainlink aggregator reverts, return a price of 0 indicating failure
            return 0;
        }
    }

    function getRoundData(
        IChainlinkAggregator priceAggregator,
        uint80 roundId
    ) private view returns (int256, uint256) {
        try priceAggregator.getRoundData(roundId) returns (
            uint80 /* roundId */,
            int256 _answer,
            uint256 /* startedAt */,
            uint256 _timestamp,
            uint80 /* answeredInRound */
        ) {
            return (_answer, _timestamp);
        } catch {
            return (-1, 0);
        }
    }

    function checkForInvalidTimestampOrAnswer(
        uint256 timestamp,
        int256 answer,
        uint256 currentTimestamp,
        uint256 maxTimeout
    ) private view returns (bool) {
        // Check for an invalid timeStamp that is 0, or in the future
        if (timestamp == 0 || timestamp > currentTimestamp) return true;
        // Check if Chainlink's price feed has timed out
        console.log("INSIDE CHECK FOR INVALID TIMESTAMP OR ANSWER IN LIBCHAINLINKORACLE");
        console.log("currentTimestamp", currentTimestamp);
        console.log("timestamp", timestamp);
        console.log("is invalid timeout:");
        console.log(currentTimestamp.sub(timestamp) > maxTimeout);
        if (currentTimestamp.sub(timestamp) > maxTimeout) return true;
        // Check for non-positive price
        if (answer <= 0) return true;

        return false;
    }
}
