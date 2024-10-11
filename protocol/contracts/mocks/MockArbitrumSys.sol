/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

/**
 * @author Brean
 * @title MockArbitrumSys
 **/
contract MockArbitrumSys {
    function arbBlockNumber() external view returns (uint256) {
        return block.number;
    }

    function arbChainID() external view returns (uint256) {
        return block.chainid;
    }
}
