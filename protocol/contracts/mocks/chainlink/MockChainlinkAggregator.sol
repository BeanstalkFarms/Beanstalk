/*
 SPDX-License-Identifier: MIT
*/
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "~/interfaces/chainlink/IChainlinkAggregator.sol";

contract MockChainlinkAggregator is IChainlinkAggregator {
    uint80 lastRound;
    mapping(uint80 => int256) answers;
    mapping(uint80 => uint256) startedAts;
    mapping(uint80 => uint256) updatedAts;
    mapping(uint80 => uint80) answeredInRounds;
    uint8 _decimals;

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external view override returns (string memory) {
        return "Mock CHainlink Aggregator";
    }

    function version() external view override returns (uint256) {
        return 1;
    }

    function getRoundData(
        uint80 _roundId
    ) 
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = _roundId;
        answer = answers[_roundId];
        startedAt = startedAts[_roundId];
        updatedAt = updatedAts[_roundId];
        answeredInRound = answeredInRounds[_roundId];
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = lastRound;
        answer = answers[lastRound];
        startedAt = startedAts[lastRound];
        updatedAt = updatedAts[lastRound];
        answeredInRound = answeredInRounds[lastRound];
    }

    function addRound(
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) external {
        lastRound += 1;
        answers[lastRound] = answer;
        startedAts[lastRound] = startedAt;
        updatedAts[lastRound] = updatedAt;
        answeredInRounds[lastRound] = answeredInRound;
    }

    function setDecimals(
        uint8 __decimals
    ) external {
        _decimals = __decimals;
    }
}
