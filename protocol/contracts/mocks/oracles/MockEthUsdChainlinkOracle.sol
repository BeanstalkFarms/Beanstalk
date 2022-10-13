/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IChainlinkOracle.sol";

/**
 * @author Publius
 * @title MockSiloToken is a mintable ERC-20 Token.
**/
contract MockEthUsdChainlinkOracle is IChainlinkOracle {

    uint80 private roundId;
    int256 private answer;
    uint256 private startedAt;
    uint256 private updatedAt;
    uint80 private answeredInRound;

    uint256 _version = 1;
    string _description;
    uint8 _decimals = 8;

    function decimals() external override view returns (uint8) {
        return _decimals;
    }

    function description() external override view returns (string memory) {
        return _description;
    }

    function version() external override view returns (uint256) {
        return _version;
    }

    function getRoundData(uint80 _roundId) 
        external
        override
        view 
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (
            _roundId,
            answer,
            startedAt,
            updatedAt,
            answeredInRound
        );
    }

    function latestRoundData()
        external
        override
        view
        returns (
        uint80,
        int256,
        uint256,
        uint256,
        uint80
        )
    {
        return (
            roundId,
            answer,
            startedAt,
            updatedAt,
            answeredInRound
        );

    }

    function setRoundData(
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        roundId = _roundId;
        answer = _answer;
        startedAt = _startedAt;
        updatedAt = _updatedAt;
        answeredInRound = _answeredInRound;
    }

}
