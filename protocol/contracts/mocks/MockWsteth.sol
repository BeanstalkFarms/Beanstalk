/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "./MockToken.sol";
import {IWsteth} from "contracts/libraries/Oracle/LibWstethEthOracle.sol";

/**
 * @author Brendan
 * @title Mock WStEth
 **/
contract MockWsteth is MockToken {
    uint256 _stEthPerToken;

    constructor() MockToken("Wrapped Staked Ether", "WSTETH") {
        _stEthPerToken = 1e18;
    }

    function setStEthPerToken(uint256 __stEthPerToken) external {
        _stEthPerToken = __stEthPerToken;
    }

    function stEthPerToken() external view returns (uint256) {
        return _stEthPerToken;
    }
}
