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

    function latestAnswer() external pure override returns (uint256) {
        return 1320e8;
    }
}
