/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IChainlink.sol";

/**
 * @author Chaikitty
 * @title MockChainlink is a Mock version of Chainlink oracle for grabbing latest ETH price
**/
contract MockChainlink is IChainlink  {

    uint256 private answer;

    function latestAnswer() external view override returns (uint256) {
        return answer;
    }

    function setAnswer(uint256 ans) public {
        answer = ans;
    }
}
