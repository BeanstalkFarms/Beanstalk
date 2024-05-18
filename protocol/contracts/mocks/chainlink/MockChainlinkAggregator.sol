/*
 SPDX-License-Identifier: MIT
*/
pragma solidity ^0.8.20;

import "contracts/interfaces/chainlink/IChainlinkAggregator.sol";

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

    function description() external pure override returns (string memory) {
        return "Mock Chainlink Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getLatestRoundId() external view returns (uint80) {
        return lastRound;
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
        if (_roundId > lastRound) revert();
        if (_roundId == 0) revert();
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
        if (lastRound == 0) revert();
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

    function setRound(
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) external {
        answers[roundId] = answer;
        startedAts[roundId] = startedAt;
        updatedAts[roundId] = updatedAt;
        answeredInRounds[roundId] = answeredInRound;
    }

    function setDecimals(uint8 __decimals) external {
        _decimals = __decimals;
    }

    function setOracleFailure() external {
        lastRound = 0;
    }
}
